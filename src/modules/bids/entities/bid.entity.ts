import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BidStatus } from '../../../common/types/bid-status.enum';
import { TaskEntity } from '../../tasks/entities/task.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity({ name: 'bids' })
export class BidEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: string;

  @ManyToOne(() => TaskEntity, (task) => task.bids, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: TaskEntity;

  @Column({ name: 'contractor_id', type: 'uuid' })
  contractorId!: string;

  @ManyToOne(() => UserEntity, (user) => user.bids, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contractor_id' })
  contractor!: UserEntity;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ type: 'enum', enum: BidStatus, default: BidStatus.PENDING })
  status!: BidStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
