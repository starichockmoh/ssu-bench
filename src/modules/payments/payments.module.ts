import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentsRepository } from './repo/payments.repository';
import { PaymentsService } from './service/payments.service';
import { PaymentsController } from './handlers/payments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity])],
  providers: [PaymentsRepository, PaymentsService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
