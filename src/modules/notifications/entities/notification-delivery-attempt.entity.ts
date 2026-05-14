import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DeliveryAttemptStatus } from '../../../common/types/delivery-attempt-status.enum';
import { NotificationEntity } from './notification.entity';

@Entity({ name: 'notification_delivery_attempts' })
export class NotificationDeliveryAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'notification_id', type: 'uuid' })
  notificationId!: string;

  @ManyToOne(() => NotificationEntity, (notification) => notification.attempts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'notification_id' })
  notification!: NotificationEntity;

  @Column({ name: 'attempt_number', type: 'integer' })
  attemptNumber!: number;

  @Column({ type: 'enum', enum: DeliveryAttemptStatus })
  status!: DeliveryAttemptStatus;

  @Column({ type: 'varchar', length: 120 })
  provider!: string;

  @Column({ name: 'error_code', type: 'varchar', length: 120, nullable: true })
  errorCode!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt!: Date;
}
