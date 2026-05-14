import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { UsersRepository } from './repo/users.repository';
import { UsersService } from './service/users.service';
import { UsersController } from './handlers/users.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), NotificationsModule],
  providers: [UsersRepository, UsersService],
  controllers: [UsersController],
  exports: [UsersService, UsersRepository, TypeOrmModule],
})
export class UsersModule {}
