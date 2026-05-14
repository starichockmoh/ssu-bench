import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DlqStatus } from '../../../common/types/dlq-status.enum';

@Entity({ name: 'dlq_records' })
export class DlqRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_key', type: 'varchar', length: 255, nullable: true })
  messageKey!: string | null;

  @Column({ name: 'source_topic', type: 'varchar', length: 160 })
  sourceTopic!: string;

  @Column({ name: 'target_topic', type: 'varchar', length: 160 })
  targetTopic!: string;

  @Column({ name: 'message_type', type: 'varchar', length: 120 })
  messageType!: string;

  @Column({ name: 'reason_code', type: 'varchar', length: 120 })
  reasonCode!: string;

  @Column({ name: 'reason_message', type: 'text' })
  reasonMessage!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'enum', enum: DlqStatus, default: DlqStatus.OPEN })
  status!: DlqStatus;

  @Column({ name: 'replayed_at', type: 'timestamp', nullable: true })
  replayedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
