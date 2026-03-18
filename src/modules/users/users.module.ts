import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { UsersRepository } from './repo/users.repository';
import { UsersService } from './service/users.service';
import { UsersController } from './handlers/users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [UsersRepository, UsersService],
  controllers: [UsersController],
  exports: [UsersService, UsersRepository, TypeOrmModule],
})
export class UsersModule {}
