import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuthUser } from '../../../common/interfaces/auth-user.interface';
import { BidStatus } from '../../../common/types/bid-status.enum';
import { UserRole } from '../../../common/types/role.enum';
import { TaskStatus } from '../../../common/types/task-status.enum';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { getPagination } from '../../../common/utils/pagination';
import { BidEntity } from '../../bids/entities/bid.entity';
import { PaymentEntity } from '../../payments/entities/payment.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { UsersService } from '../../users/service/users.service';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TaskEntity } from '../entities/task.entity';
import { TasksRepository } from '../repo/tasks.repository';
import { DomainEventsService } from '../../notifications/service/domain-events.service';
import { NotificationEventType } from '../../notifications/constants/event-types';

@Injectable()
export class TasksService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly usersService: UsersService,
    @InjectRepository(BidEntity)
    private readonly bidsRepository: Repository<BidEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentsRepository: Repository<PaymentEntity>,
    private readonly domainEventsService: DomainEventsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async createTask(dto: CreateTaskDto, authUser: AuthUser): Promise<TaskEntity> {
    this.ensureRole(authUser, [UserRole.CUSTOMER, UserRole.ADMIN]);
    const customer = await this.usersService.getByIdOrFail(authUser.sub);
    this.usersService.ensureNotBlocked(customer);

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TaskEntity);
      const task = repository.create({
        ...dto,
        customerId: customer.id,
        status: TaskStatus.DRAFT,
        selectedBidId: null,
      });

      const savedTask = await repository.save(task);
      await this.domainEventsService.appendEvent({
        manager,
        eventType: NotificationEventType.TaskCreated,
        aggregateType: 'task',
        aggregateId: savedTask.id,
        initiatorUserId: authUser.sub,
        payload: {
          taskId: savedTask.id,
          customerId: customer.id,
          title: savedTask.title,
          price: savedTask.price,
        },
      });

      return savedTask;
    });
  }

  async listTasks(query: PaginationQueryDto): Promise<PaginatedResponseDto<TaskEntity>> {
    const { page, limit, skip } = getPagination(query);
    const [items, total] = await this.tasksRepository.findAndCount({
      take: limit,
      skip,
      order: { createdAt: 'DESC' },
      relations: {
        customer: true,
        selectedBid: true,
      },
    });

    return { items, total, page, limit };
  }

  async getTask(id: string): Promise<TaskEntity> {
    return this.getTaskOrFail(id);
  }

  async updateTask(id: string, dto: UpdateTaskDto, authUser: AuthUser): Promise<TaskEntity> {
    const task = await this.getOwnedTaskOrAdmin(id, authUser);
    this.ensureEditable(task);

    Object.assign(task, dto);
    return this.tasksRepository.save(task);
  }

  async publishTask(id: string, authUser: AuthUser): Promise<TaskEntity> {
    const task = await this.getOwnedTaskOrAdmin(id, authUser);
    if (task.status !== TaskStatus.DRAFT) {
      throw new UnprocessableEntityException({
        code: 'TASK_INVALID_STATUS',
        message: 'Only draft tasks can be published',
      });
    }
    task.status = TaskStatus.PUBLISHED;
    return this.tasksRepository.save(task);
  }

  async cancelTask(id: string, authUser: AuthUser): Promise<TaskEntity> {
    const task = await this.getOwnedTaskOrAdmin(id, authUser);
    if ([TaskStatus.DONE, TaskStatus.CANCELLED, TaskStatus.COMPLETED_BY_CONTRACTOR].includes(task.status)) {
      throw new UnprocessableEntityException({
        code: 'TASK_CANNOT_CANCEL',
        message: 'Task cannot be cancelled in the current status',
      });
    }
    task.status = TaskStatus.CANCELLED;
    return this.tasksRepository.save(task);
  }

  async markCompleted(id: string, authUser: AuthUser): Promise<TaskEntity> {
    const task = await this.getTaskOrFail(id);

    if (task.status !== TaskStatus.IN_PROGRESS) {
      throw new UnprocessableEntityException({
        code: 'TASK_INVALID_STATUS',
        message: 'Task must be in progress',
      });
    }

    const bid = await this.getSelectedBid(task);
    if (!bid || (bid.contractorId !== authUser.sub && authUser.role !== UserRole.ADMIN)) {
      throw new ForbiddenException({
        code: 'TASK_COMPLETE_FORBIDDEN',
        message: 'Only selected contractor can complete task',
      });
    }

    const contractor = await this.usersService.getByIdOrFail(bid.contractorId);
    this.usersService.ensureNotBlocked(contractor);

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TaskEntity);
      task.status = TaskStatus.COMPLETED_BY_CONTRACTOR;
      const savedTask = await repository.save(task);
      await this.domainEventsService.appendEvent({
        manager,
        eventType: NotificationEventType.TaskCompletedByContractor,
        aggregateType: 'task',
        aggregateId: savedTask.id,
        initiatorUserId: authUser.sub,
        payload: {
          taskId: savedTask.id,
          customerId: savedTask.customerId,
          contractorId: bid.contractorId,
          title: savedTask.title,
        },
      });

      return savedTask;
    });
  }

  async confirmTask(id: string, authUser: AuthUser): Promise<TaskEntity> {
    const currentUser = await this.usersService.getByIdOrFail(authUser.sub);
    this.usersService.ensureNotBlocked(currentUser);

    return this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const bidRepository = manager.getRepository(BidEntity);
      const userRepository = manager.getRepository(UserEntity);
      const paymentRepository = manager.getRepository(PaymentEntity);

      const task = await taskRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!task) {
        throw new NotFoundException({
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
        });
      }

      if (task.customerId !== authUser.sub && authUser.role !== UserRole.ADMIN) {
        throw new ForbiddenException({
          code: 'TASK_CONFIRM_FORBIDDEN',
          message: 'Only customer can confirm task completion',
        });
      }

      if (task.status !== TaskStatus.COMPLETED_BY_CONTRACTOR) {
        throw new UnprocessableEntityException({
          code: 'TASK_INVALID_STATUS',
          message: 'Task must be completed by contractor before confirmation',
        });
      }

      const bid = task.selectedBidId
        ? await bidRepository.findOne({
            where: { id: task.selectedBidId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;

      if (!bid) {
        throw new UnprocessableEntityException({
          code: 'TASK_SELECTED_BID_REQUIRED',
          message: 'Task has no selected bid',
        });
      }

      const customer = await userRepository.findOne({
        where: { id: task.customerId },
        lock: { mode: 'pessimistic_write' },
      });
      const contractor = await userRepository.findOne({
        where: { id: bid.contractorId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!customer || !contractor) {
        throw new NotFoundException({
          code: 'USER_NOT_FOUND',
          message: 'Task participants not found',
        });
      }

      if (customer.balance < task.price) {
        throw new UnprocessableEntityException({
          code: 'INSUFFICIENT_BALANCE',
          message: 'Customer does not have enough balance',
        });
      }

      customer.balance -= task.price;
      contractor.balance += task.price;
      task.status = TaskStatus.DONE;

      await userRepository.save(customer);
      await userRepository.save(contractor);
      await paymentRepository.save(
        paymentRepository.create({
          taskId: task.id,
          fromUserId: customer.id,
          toUserId: contractor.id,
          amount: task.price,
        }),
      );
      const savedTask = await taskRepository.save(task);

      await this.domainEventsService.appendEvent({
        manager,
        eventType: NotificationEventType.TaskConfirmed,
        aggregateType: 'task',
        aggregateId: savedTask.id,
        initiatorUserId: authUser.sub,
        payload: {
          taskId: savedTask.id,
          customerId: customer.id,
          contractorId: contractor.id,
          title: savedTask.title,
          amount: task.price,
        },
      });
      await this.domainEventsService.appendEvent({
        manager,
        eventType: NotificationEventType.PaymentCompleted,
        aggregateType: 'payment',
        aggregateId: savedTask.id,
        initiatorUserId: authUser.sub,
        payload: {
          taskId: savedTask.id,
          customerId: customer.id,
          contractorId: contractor.id,
          amount: task.price,
        },
      });

      return savedTask;
    });
  }

  async selectBid(taskId: string, bidId: string, authUser: AuthUser): Promise<TaskEntity> {
    const task = await this.getOwnedTaskOrAdmin(taskId, authUser);
    if (task.status !== TaskStatus.PUBLISHED) {
      throw new UnprocessableEntityException({
        code: 'TASK_INVALID_STATUS',
        message: 'Task must be published to select bid',
      });
    }

    const bid = await this.bidsRepository.findOne({
      where: { id: bidId, taskId },
    });
    if (!bid) {
      throw new NotFoundException({
        code: 'BID_NOT_FOUND',
        message: 'Bid not found',
      });
    }

    await this.dataSource.transaction(async (manager) => {
      const bidRepo = manager.getRepository(BidEntity);
      const taskRepo = manager.getRepository(TaskEntity);

      await bidRepo.update({ taskId, status: BidStatus.PENDING, id: In([bid.id]) }, { status: BidStatus.SELECTED });
      // если есть другие биды с текущим taskId - отменяем
      await bidRepo.update(
        { taskId, status: BidStatus.PENDING, id: In((await bidRepo.find({ where: { taskId } })).filter((item) => item.id !== bid.id).map((item) => item.id)) },
        { status: BidStatus.REJECTED },
      );

      task.selectedBidId = bid.id;
      task.status = TaskStatus.IN_PROGRESS;
      await taskRepo.save(task);
      await this.domainEventsService.appendEvent({
        manager,
        eventType: NotificationEventType.BidSelected,
        aggregateType: 'task',
        aggregateId: task.id,
        initiatorUserId: authUser.sub,
        payload: {
          taskId: task.id,
          bidId: bid.id,
          contractorId: bid.contractorId,
          customerId: task.customerId,
          title: task.title,
        },
      });
    });

    return this.getTaskOrFail(taskId);
  }

  async getSelectedBid(task: TaskEntity): Promise<BidEntity | null> {
    if (!task.selectedBidId) {
      return null;
    }

    return this.bidsRepository.findOne({ where: { id: task.selectedBidId } });
  }

  private async getOwnedTaskOrAdmin(id: string, authUser: AuthUser): Promise<TaskEntity> {
    const task = await this.getTaskOrFail(id);

    if (task.customerId !== authUser.sub && authUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: 'TASK_FORBIDDEN',
        message: 'Only task owner can perform this operation',
      });
    }

    const owner = await this.usersService.getByIdOrFail(task.customerId);
    this.usersService.ensureNotBlocked(owner);

    return task;
  }

  private async getTaskOrFail(id: string): Promise<TaskEntity> {
    const task = await this.tasksRepository.findById(id);
    if (!task) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Task not found',
      });
    }
    return task;
  }

  private ensureEditable(task: TaskEntity): void {
    if (task.status !== TaskStatus.DRAFT) {
      throw new UnprocessableEntityException({
        code: 'TASK_EDIT_FORBIDDEN',
        message: 'Only draft tasks can be edited',
      });
    }
  }

  private ensureRole(authUser: AuthUser, roles: UserRole[]): void {
    if (!roles.includes(authUser.role)) {
      throw new ForbiddenException({
        code: 'AUTH_FORBIDDEN',
        message: 'Insufficient role permissions',
      });
    }
  }
}
