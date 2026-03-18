import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/interfaces/auth-user.interface';
import { CreateBidDto } from '../dto/create-bid.dto';
import { BidsService } from '../service/bids.service';
import { TasksService } from '../../tasks/service/tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class BidsController {
  constructor(
    private readonly bidsService: BidsService,
    private readonly tasksService: TasksService,
  ) {}

  @Post(':id/bids')
  createBid(
    @Param('id') taskId: string,
    @Body() dto: CreateBidDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bidsService.createBid(taskId, dto, user);
  }

  @Get(':id/bids')
  listTaskBids(
    @Param('id') taskId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.bidsService.listTaskBids(taskId, user, query);
  }

  @Post(':taskId/bids/:bidId/select')
  selectBid(
    @Param('taskId') taskId: string,
    @Param('bidId') bidId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.selectBid(taskId, bidId, user);
  }
}
