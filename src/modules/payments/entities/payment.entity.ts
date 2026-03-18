import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TaskEntity } from '../../tasks/entities/task.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity({ name: 'payments' })
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: string;

  @ManyToOne(() => TaskEntity, (task) => task.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: TaskEntity;

  @Column({ name: 'from_user_id', type: 'uuid' })
  fromUserId!: string;

  @ManyToOne(() => UserEntity, (user) => user.outgoingPayments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_user_id' })
  fromUser!: UserEntity;

  @Column({ name: 'to_user_id', type: 'uuid' })
  toUserId!: string;

  @ManyToOne(() => UserEntity, (user) => user.incomingPayments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_user_id' })
  toUser!: UserEntity;

  @Column({ type: 'integer' })
  amount!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
