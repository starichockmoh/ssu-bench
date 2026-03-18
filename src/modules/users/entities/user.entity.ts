import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../../common/types/role.enum';
import { TaskEntity } from '../../tasks/entities/task.entity';
import { BidEntity } from '../../bids/entities/bid.entity';
import { PaymentEntity } from '../../payments/entities/payment.entity';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole })
  role!: UserRole;

  @Column({ type: 'integer', default: 0 })
  balance!: number;

  @Column({ name: 'is_blocked', type: 'boolean', default: false })
  isBlocked!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => TaskEntity, (task) => task.customer)
  tasks!: TaskEntity[];

  @OneToMany(() => BidEntity, (bid) => bid.contractor)
  bids!: BidEntity[];

  @OneToMany(() => PaymentEntity, (payment) => payment.fromUser)
  outgoingPayments!: PaymentEntity[];

  @OneToMany(() => PaymentEntity, (payment) => payment.toUser)
  incomingPayments!: PaymentEntity[];

  @BeforeInsert()
  normalizeEmail(): void {
    this.email = this.email.trim().toLowerCase();
  }
}
