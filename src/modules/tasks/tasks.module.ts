import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from './entities/task.entity';
import { TasksRepository } from './repo/tasks.repository';
import { TasksService } from './service/tasks.service';
import { TasksController } from './handlers/tasks.controller';
import { UsersModule } from '../users/users.module';
import { BidEntity } from '../bids/entities/bid.entity';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { BidsModule } from '../bids/bids.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity, BidEntity, PaymentEntity]), // forFeature() создаёт провайдеры репозиториев
    UsersModule,
    NotificationsModule,
    forwardRef(() => BidsModule), // forwardRef() отложенная ссылка на модуль (без циклов)
  ],
  providers: [TasksRepository, TasksService],
  controllers: [TasksController],
  exports: [TasksRepository, TasksService, TypeOrmModule],
})
export class TasksModule {}
