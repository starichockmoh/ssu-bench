import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { AuthUser } from '../../../common/interfaces/auth-user.interface';
import { UserRole } from '../../../common/types/role.enum';
import { getPagination } from '../../../common/utils/pagination';
import { PaymentEntity } from '../entities/payment.entity';
import { PaymentsRepository } from '../repo/payments.repository';

@Injectable()
export class PaymentsService {
  constructor(private readonly paymentsRepository: PaymentsRepository) {}

  async listPayments(query: PaginationQueryDto, authUser: AuthUser): Promise<PaginatedResponseDto<PaymentEntity>> {
    const { page, limit, skip } = getPagination(query);
    const where =
      authUser.role === UserRole.ADMIN
        ? {}
        : [{ fromUserId: authUser.sub }, { toUserId: authUser.sub }];

    const [items, total] = await this.paymentsRepository.findAndCount({
      where,
      relations: { task: true, fromUser: true, toUser: true },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async getPayment(id: string, authUser: AuthUser): Promise<PaymentEntity> {
    const payment = await this.paymentsRepository.findById(id);
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment not found',
      });
    }

    if (
      authUser.role !== UserRole.ADMIN &&
      payment.fromUserId !== authUser.sub &&
      payment.toUserId !== authUser.sub
    ) {
      throw new ForbiddenException({
        code: 'PAYMENT_FORBIDDEN',
        message: 'Payment access denied',
      });
    }

    return payment;
  }
}
