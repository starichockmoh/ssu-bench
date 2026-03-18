import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BidEntity } from './entities/bid.entity';
import { BidsRepository } from './repo/bids.repository';
import { BidsService } from './service/bids.service';
import { BidsController } from './handlers/bids.controller';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BidEntity]),
    forwardRef(() => TasksModule),
    UsersModule,
  ],
  providers: [BidsRepository, BidsService],
  controllers: [BidsController],
  exports: [BidsRepository, BidsService, TypeOrmModule],
})
export class BidsModule {}
