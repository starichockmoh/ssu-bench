import { ForbiddenException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { UserRole } from '../../../common/types/role.enum';

describe('PaymentsService', () => {
  const paymentsRepository = {
    findAndCount: jest.fn(),
    findById: jest.fn(),
  };

  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentsService(paymentsRepository as never);
  });

  it('limits payment listing to current user for non-admin', async () => {
    paymentsRepository.findAndCount.mockResolvedValue([[], 0]);

    await service.listPayments(
      { page: 1, limit: 10 },
      {
        sub: 'user-1',
        role: UserRole.CUSTOMER,
        email: 'user@test',
        isBlocked: false,
      },
    );

    expect(paymentsRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [{ fromUserId: 'user-1' }, { toUserId: 'user-1' }],
      }),
    );
  });

  it('forbids access to unrelated payment', async () => {
    paymentsRepository.findById.mockResolvedValue({
      id: 'payment-1',
      fromUserId: 'user-2',
      toUserId: 'user-3',
    });

    await expect(
      service.getPayment('payment-1', {
        sub: 'user-1',
        role: UserRole.CUSTOMER,
        email: 'user@test',
        isBlocked: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
