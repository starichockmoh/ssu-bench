import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaskStatus } from '../../../common/types/task-status.enum';
import { UserEntity } from '../../users/entities/user.entity';
import { BidEntity } from '../../bids/entities/bid.entity';
import { PaymentEntity } from '../../payments/entities/payment.entity';

@Entity({ name: 'tasks' })
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'integer' })
  price!: number;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.DRAFT })
  status!: TaskStatus;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @ManyToOne(() => UserEntity, (user) => user.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: UserEntity;

  @Column({ name: 'selected_bid_id', type: 'uuid', nullable: true })
  selectedBidId!: string | null;

  @OneToOne(() => BidEntity, { nullable: true })
  @JoinColumn({ name: 'selected_bid_id' })
  selectedBid!: BidEntity | null;

  @OneToMany(() => BidEntity, (bid) => bid.task)
  bids!: BidEntity[];

  @OneToMany(() => PaymentEntity, (payment) => payment.task)
  payments!: PaymentEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
