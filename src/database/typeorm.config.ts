import { DataSource } from 'typeorm';
import { appConfig } from '../config/app.config';
import { UserEntity } from '../modules/users/entities/user.entity';
import { TaskEntity } from '../modules/tasks/entities/task.entity';
import { BidEntity } from '../modules/bids/entities/bid.entity';
import { PaymentEntity } from '../modules/payments/entities/payment.entity';

export default new DataSource({
  type: 'postgres',
  host: appConfig.db.host,
  port: appConfig.db.port,
  username: appConfig.db.username,
  password: appConfig.db.password,
  database: appConfig.db.database,
  entities: [UserEntity, TaskEntity, BidEntity, PaymentEntity],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
