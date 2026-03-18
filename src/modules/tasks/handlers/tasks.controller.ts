import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/interfaces/auth-user.interface';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TasksService } from '../service/tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  createTask(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthUser) {
    return this.tasksService.createTask(dto, user);
  }

  @Get()
  listTasks(@Query() query: PaginationQueryDto) {
    return this.tasksService.listTasks(query);
  }

  @Get(':id')
  getTask(@Param('id') id: string) {
    return this.tasksService.getTask(id);
  }

  @Patch(':id')
  updateTask(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.updateTask(id, dto, user);
  }

  @Post(':id/publish')
  publishTask(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasksService.publishTask(id, user);
  }

  @Post(':id/cancel')
  cancelTask(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasksService.cancelTask(id, user);
  }

  @Post(':id/complete')
  completeTask(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasksService.markCompleted(id, user);
  }

  @Post(':id/confirm')
  confirmTask(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasksService.confirmTask(id, user);
  }
}
