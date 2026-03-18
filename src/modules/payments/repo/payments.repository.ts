import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { PaymentEntity } from '../entities/payment.entity';

@Injectable()
export class PaymentsRepository {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repository: Repository<PaymentEntity>,
  ) {}

  findAndCount(options: FindManyOptions<PaymentEntity>): Promise<[PaymentEntity[], number]> {
    return this.repository.findAndCount(options);
  }

  findById(id: string): Promise<PaymentEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        task: true,
        fromUser: true,
        toUser: true,
      },
    });
  }
}
