import { Module } from '@nestjs/common';
import { AuthController } from './handlers/auth.controller';
import { AuthService } from './service/auth.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
