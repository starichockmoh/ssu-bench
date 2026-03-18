import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { BidsService } from './bids.service';
import { UserRole } from '../../../common/types/role.enum';
import { TaskStatus } from '../../../common/types/task-status.enum';

describe('BidsService', () => {
  const bidsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOneByTaskAndContractor: jest.fn(),
    findAndCount: jest.fn(),
  };
  const tasksRepository = {
    findById: jest.fn(),
  };
  const usersService = {
    getByIdOrFail: jest.fn(),
    ensureNotBlocked: jest.fn(),
  };

  let service: BidsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BidsService(
      bidsRepository as never,
      tasksRepository as never,
      usersService as never,
    );
  });

  it('rejects bid creation for customer role', async () => {
    await expect(
      service.createBid(
        'task-1',
        {},
        { sub: 'user-1', role: UserRole.CUSTOMER, email: 'u@test', isBlocked: false },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects bid creation on own task', async () => {
    tasksRepository.findById.mockResolvedValue({
      id: 'task-1',
      customerId: 'contractor-1',
      status: TaskStatus.PUBLISHED,
    });

    await expect(
      service.createBid(
        'task-1',
        {},
        {
          sub: 'contractor-1',
          role: UserRole.CONTRACTOR,
          email: 'u@test',
          isBlocked: false,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects duplicate bids for the same task', async () => {
    tasksRepository.findById.mockResolvedValue({
      id: 'task-1',
      customerId: 'customer-1',
      status: TaskStatus.PUBLISHED,
    });
    usersService.getByIdOrFail.mockResolvedValue({ id: 'contractor-1', isBlocked: false });
    bidsRepository.findOneByTaskAndContractor.mockResolvedValue({ id: 'bid-1' });

    await expect(
      service.createBid(
        'task-1',
        {},
        {
          sub: 'contractor-1',
          role: UserRole.CONTRACTOR,
          email: 'u@test',
          isBlocked: false,
        },
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('allows only owner or admin to list bids', async () => {
    tasksRepository.findById.mockResolvedValue({
      id: 'task-1',
      customerId: 'customer-1',
      status: TaskStatus.PUBLISHED,
    });

    await expect(
      service.listTaskBids(
        'task-1',
        {
          sub: 'contractor-1',
          role: UserRole.CONTRACTOR,
          email: 'u@test',
          isBlocked: false,
        },
        { page: 1, limit: 10 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
