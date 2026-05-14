import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/entities/user.entity';
import { TaskEntity } from '../tasks/entities/task.entity';
import { BidEntity } from '../bids/entities/bid.entity';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { OutboxEventEntity } from './entities/outbox-event.entity';
import { IncomingEventEntity } from './entities/incoming-event.entity';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationDeliveryAttemptEntity } from './entities/notification-delivery-attempt.entity';
import { DlqRecordEntity } from './entities/dlq-record.entity';
import { DomainEventsService } from './service/domain-events.service';
import { KafkaService } from './service/kafka.service';
import { OutboxProcessorService } from './service/outbox-processor.service';
import { NotificationRoutingService } from './service/notification-routing.service';
import { NotificationDeliveryService } from './service/notification-delivery.service';
import { NotificationsPipelineService } from './service/notifications-pipeline.service';
import { NotificationsQueryService } from './service/notifications-query.service';
import { NotificationsHealthService } from './service/notifications-health.service';
import { NotificationsAdminController } from './handlers/notifications-admin.controller';
import { HealthController } from './handlers/health.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      TaskEntity,
      BidEntity,
      PaymentEntity,
      OutboxEventEntity,
      IncomingEventEntity,
      NotificationEntity,
      NotificationDeliveryAttemptEntity,
      DlqRecordEntity,
      ]),
  ],
  providers: [
    DomainEventsService,
    KafkaService,
    OutboxProcessorService,
    NotificationRoutingService,
    NotificationDeliveryService,
    NotificationsPipelineService,
    NotificationsQueryService,
    NotificationsHealthService,
  ],
  controllers: [NotificationsAdminController, HealthController],
  exports: [DomainEventsService],
})
export class NotificationsModule {}
