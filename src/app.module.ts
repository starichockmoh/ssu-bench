import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { appConfig } from './config/app.config';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { BidsModule } from './modules/bids/bids.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { UserEntity } from './modules/users/entities/user.entity';
import { TaskEntity } from './modules/tasks/entities/task.entity';
import { BidEntity } from './modules/bids/entities/bid.entity';
import { PaymentEntity } from './modules/payments/entities/payment.entity';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: appConfig.jwtSecret,
      signOptions: { expiresIn: appConfig.jwtExpiresIn as never },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: appConfig.db.host,
      port: appConfig.db.port,
      username: appConfig.db.username,
      password: appConfig.db.password,
      database: appConfig.db.database,
      entities: [UserEntity, TaskEntity, BidEntity, PaymentEntity],
      synchronize: false,
      autoLoadEntities: false,
    }),
    AuthModule,
    UsersModule,
    TasksModule,
    BidsModule,
    PaymentsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
