import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationChannel } from '../../../common/types/notification-channel.enum';
import { NotificationStatus } from '../../../common/types/notification-status.enum';
import { NotificationDeliveryAttemptEntity } from './notification-delivery-attempt.entity';

@Entity({ name: 'notifications' })
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'notification_type', type: 'varchar', length: 120 })
  notificationType!: string;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel!: NotificationChannel;

  @Index()
  @Column({ name: 'recipient_user_id', type: 'uuid' })
  recipientUserId!: string;

  @Column({ name: 'recipient_address', type: 'varchar', length: 255 })
  recipientAddress!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.PENDING })
  status!: NotificationStatus;

  @Column({ name: 'suppressed_reason', type: 'varchar', length: 255, nullable: true })
  suppressedReason!: string | null;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt!: Date | null;

  @OneToMany(() => NotificationDeliveryAttemptEntity, (attempt) => attempt.notification)
  attempts!: NotificationDeliveryAttemptEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
