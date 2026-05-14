import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthUser } from '../../../common/interfaces/auth-user.interface';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { BidStatus } from '../../../common/types/bid-status.enum';
import { UserRole } from '../../../common/types/role.enum';
import { TaskStatus } from '../../../common/types/task-status.enum';
import { getPagination } from '../../../common/utils/pagination';
import { UsersService } from '../../users/service/users.service';
import { CreateBidDto } from '../dto/create-bid.dto';
import { BidEntity } from '../entities/bid.entity';
import { BidsRepository } from '../repo/bids.repository';
import { TasksRepository } from '../../tasks/repo/tasks.repository';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DomainEventsService } from '../../notifications/service/domain-events.service';
import { NotificationEventType } from '../../notifications/constants/event-types';

@Injectable()
export class BidsService {
  constructor(
    private readonly bidsRepository: BidsRepository,
    private readonly tasksRepository: TasksRepository,
    private readonly usersService: UsersService,
    private readonly domainEventsService: DomainEventsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async createBid(taskId: string, dto: CreateBidDto, authUser: AuthUser): Promise<BidEntity> {
    if (![UserRole.CONTRACTOR, UserRole.ADMIN].includes(authUser.role)) {
      throw new ForbiddenException({
        code: 'AUTH_FORBIDDEN',
        message: 'Only contractor can create bids',
      });
    }

    const task = await this.tasksRepository.findById(taskId);
    if (!task) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Task not found',
      });
    }

    if (task.status !== TaskStatus.PUBLISHED) {
      throw new UnprocessableEntityException({
        code: 'TASK_INVALID_STATUS',
        message: 'Bids can be created only for published tasks',
      });
    }

    if (task.customerId === authUser.sub) {
      throw new ForbiddenException({
        code: 'BID_SELF_FORBIDDEN',
        message: 'Customer cannot bid on own task',
      });
    }

    const contractor = await this.usersService.getByIdOrFail(authUser.sub);
    this.usersService.ensureNotBlocked(contractor);

    const existing = await this.bidsRepository.findOneByTaskAndContractor(taskId, authUser.sub);
    if (existing) {
      throw new UnprocessableEntityException({
        code: 'BID_ALREADY_EXISTS',
        message: 'Bid already exists for this task and contractor',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(BidEntity);
      const bid = repository.create({
        taskId,
        contractorId: authUser.sub,
        comment: dto.comment ?? null,
        status: BidStatus.PENDING,
      });

      const savedBid = await repository.save(bid);
      await this.domainEventsService.appendEvent({
        manager,
        eventType: NotificationEventType.BidCreated,
        aggregateType: 'bid',
        aggregateId: savedBid.id,
        initiatorUserId: authUser.sub,
        payload: {
          bidId: savedBid.id,
          taskId,
          contractorId: authUser.sub,
          customerId: task.customerId,
          comment: savedBid.comment,
        },
      });

      return savedBid;
    });
  }

  async listTaskBids(taskId: string, authUser: AuthUser, query: PaginationQueryDto): Promise<PaginatedResponseDto<BidEntity>> {
    const task = await this.tasksRepository.findById(taskId);
    if (!task) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Task not found',
      });
    }

    if (task.customerId !== authUser.sub && authUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: 'BIDS_FORBIDDEN',
        message: 'Only task owner or admin can view bids',
      });
    }

    const { page, limit, skip } = getPagination(query);
    const [items, total] = await this.bidsRepository.findAndCount({
      where: { taskId },
      relations: { contractor: true },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { items, total, page, limit };
  }
}
