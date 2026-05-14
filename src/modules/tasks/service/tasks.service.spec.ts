import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { UserRole } from '../../../common/types/role.enum';
import { TaskStatus } from '../../../common/types/task-status.enum';
import { BidStatus } from '../../../common/types/bid-status.enum';

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'user@example.com',
  role: UserRole.CUSTOMER,
  balance: 100,
  isBlocked: false,
  ...overrides,
});

const makeTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1',
  title: 'Task',
  description: 'Task description',
  price: 20,
  customerId: 'customer-1',
  status: TaskStatus.DRAFT,
  selectedBidId: null,
  ...overrides,
});

describe('TasksService', () => {
  const tasksRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findById: jest.fn(),
    findAndCount: jest.fn(),
  };
  const usersService = {
    getByIdOrFail: jest.fn(),
    ensureNotBlocked: jest.fn(),
  };
  const bidsRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
  };
  const usersRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const paymentsRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const domainEventsService = {
    appendEvent: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(),
  };

  let service: TasksService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TasksService(
      tasksRepository as never,
      usersService as never,
      bidsRepository as never,
      usersRepository as never,
      paymentsRepository as never,
      domainEventsService as never,
      dataSource as never,
    );
  });

  it('rejects task creation for contractor role', async () => {
    await expect(
      service.createTask(
        { title: 'Task', description: 'Description here', price: 10 },
        { sub: 'contractor-1', role: UserRole.CONTRACTOR, email: 'c@test', isBlocked: false },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('publishes only draft task', async () => {
    tasksRepository.findById.mockResolvedValue(makeTask({ status: TaskStatus.PUBLISHED }));
    usersService.getByIdOrFail.mockResolvedValue(makeUser({ id: 'customer-1' }));

    await expect(
      service.publishTask('task-1', {
        sub: 'customer-1',
        role: UserRole.CUSTOMER,
        email: 'customer@test',
        isBlocked: false,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('allows cancel only for non-final statuses', async () => {
    tasksRepository.findById.mockResolvedValue(
      makeTask({ status: TaskStatus.COMPLETED_BY_CONTRACTOR }),
    );
    usersService.getByIdOrFail.mockResolvedValue(makeUser({ id: 'customer-1' }));

    await expect(
      service.cancelTask('task-1', {
        sub: 'customer-1',
        role: UserRole.CUSTOMER,
        email: 'customer@test',
        isBlocked: false,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('prevents updating non-draft task', async () => {
    tasksRepository.findById.mockResolvedValue(makeTask({ status: TaskStatus.PUBLISHED }));
    usersService.getByIdOrFail.mockResolvedValue(makeUser({ id: 'customer-1' }));

    await expect(
      service.updateTask(
        'task-1',
        { title: 'Updated' },
        { sub: 'customer-1', role: UserRole.CUSTOMER, email: 'customer@test', isBlocked: false },
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('allows only selected contractor to mark task completed', async () => {
    tasksRepository.findById.mockResolvedValue(
      makeTask({ status: TaskStatus.IN_PROGRESS, selectedBidId: 'bid-1' }),
    );
    bidsRepository.findOne.mockResolvedValue({
      id: 'bid-1',
      contractorId: 'contractor-1',
      status: BidStatus.SELECTED,
    });

    await expect(
      service.markCompleted('task-1', {
        sub: 'contractor-2',
        role: UserRole.CONTRACTOR,
        email: 'contractor@test',
        isBlocked: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects task confirmation by non-owner', async () => {
    const manager = {
      getRepository: jest
        .fn()
        .mockReturnValueOnce({
          findOne: jest.fn().mockResolvedValue(
            makeTask({
              status: TaskStatus.COMPLETED_BY_CONTRACTOR,
              selectedBidId: 'bid-1',
            }),
          ),
        })
        .mockReturnValueOnce({ findOne: jest.fn() })
        .mockReturnValueOnce({ findOne: jest.fn() })
        .mockReturnValueOnce({ create: jest.fn(), save: jest.fn() }),
    };
    usersService.getByIdOrFail.mockResolvedValue(makeUser({ id: 'other-user' }));
    dataSource.transaction.mockImplementation((callback: (manager: unknown) => unknown) =>
      callback(manager),
    );

    await expect(
      service.confirmTask('task-1', {
        sub: 'other-user',
        role: UserRole.CUSTOMER,
        email: 'other@test',
        isBlocked: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects task confirmation for insufficient balance', async () => {
    const taskRepo = {
      findOne: jest.fn().mockResolvedValue(
        makeTask({
          status: TaskStatus.COMPLETED_BY_CONTRACTOR,
          customerId: 'customer-1',
          selectedBidId: 'bid-1',
          price: 120,
        }),
      ),
      save: jest.fn(),
    };
    const bidRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'bid-1', contractorId: 'contractor-1' }),
    };
    const userRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(makeUser({ id: 'customer-1', balance: 50 }))
        .mockResolvedValueOnce(makeUser({ id: 'contractor-1', role: UserRole.CONTRACTOR, balance: 0 })),
      save: jest.fn(),
    };
    const paymentRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    dataSource.transaction.mockImplementation((callback: (manager: unknown) => unknown) =>
      callback({
        getRepository: jest
          .fn()
          .mockReturnValueOnce(taskRepo)
          .mockReturnValueOnce(bidRepo)
          .mockReturnValueOnce(userRepo)
          .mockReturnValueOnce(paymentRepo),
      }),
    );
    usersService.getByIdOrFail.mockResolvedValue(makeUser({ id: 'customer-1', balance: 50 }));

    await expect(
      service.confirmTask('task-1', {
        sub: 'customer-1',
        role: UserRole.CUSTOMER,
        email: 'customer@test',
        isBlocked: false,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('executes confirmation as atomic payment transaction', async () => {
    const task = makeTask({
      status: TaskStatus.COMPLETED_BY_CONTRACTOR,
      customerId: 'customer-1',
      selectedBidId: 'bid-1',
      price: 20,
    });
    const customer = makeUser({ id: 'customer-1', balance: 80 });
    const contractor = makeUser({
      id: 'contractor-1',
      role: UserRole.CONTRACTOR,
      balance: 10,
    });
    const taskRepo = {
      findOne: jest.fn().mockResolvedValue(task),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const bidRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'bid-1', contractorId: 'contractor-1' }),
    };
    const userRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(customer)
        .mockResolvedValueOnce(contractor),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const paymentRecord = { id: 'payment-1' };
    const paymentRepo = {
      create: jest.fn().mockReturnValue(paymentRecord),
      save: jest.fn().mockResolvedValue(paymentRecord),
    };
    dataSource.transaction.mockImplementation((callback: (manager: unknown) => unknown) =>
      callback({
        getRepository: jest
          .fn()
          .mockReturnValueOnce(taskRepo)
          .mockReturnValueOnce(bidRepo)
          .mockReturnValueOnce(userRepo)
          .mockReturnValueOnce(paymentRepo),
      }),
    );
    usersService.getByIdOrFail.mockResolvedValue(makeUser({ id: 'customer-1', balance: 80 }));

    const result = await service.confirmTask('task-1', {
      sub: 'customer-1',
      role: UserRole.CUSTOMER,
      email: 'customer@test',
      isBlocked: false,
    });

    expect(result.status).toBe(TaskStatus.DONE);
    expect(customer.balance).toBe(60);
    expect(contractor.balance).toBe(30);
    expect(paymentRepo.create).toHaveBeenCalledWith({
      taskId: 'task-1',
      fromUserId: 'customer-1',
      toUserId: 'contractor-1',
      amount: 20,
    });
    expect(userRepo.save).toHaveBeenCalledTimes(2);
    expect(taskRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: TaskStatus.DONE }));
  });

  it('throws not found for missing task', async () => {
    tasksRepository.findById.mockResolvedValue(null);

    await expect(service.getTask('missing-task')).rejects.toBeInstanceOf(NotFoundException);
  });
});
