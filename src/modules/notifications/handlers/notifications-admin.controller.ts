import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/types/role.enum';
import { PublishTestEventDto } from '../dto/publish-test-event.dto';
import { ListEventsQueryDto } from '../dto/list-events-query.dto';
import { ListNotificationsQueryDto } from '../dto/list-notifications-query.dto';
import { ListDeliveriesQueryDto } from '../dto/list-deliveries-query.dto';
import { ListDlqQueryDto } from '../dto/list-dlq-query.dto';
import { NotificationsQueryService } from '../service/notifications-query.service';
import { NotificationsPipelineService } from '../service/notifications-pipeline.service';

@Controller('technical')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class NotificationsAdminController {
  constructor(
    private readonly queryService: NotificationsQueryService,
    private readonly pipelineService: NotificationsPipelineService,
  ) {}

  @Get('events')
  listEvents(@Query() query: ListEventsQueryDto) {
    return this.queryService.listIncomingEvents(query);
  }

  @Get('notifications')
  listNotifications(@Query() query: ListNotificationsQueryDto) {
    return this.queryService.listNotifications(query);
  }

  @Get('deliveries')
  listDeliveries(@Query() query: ListDeliveriesQueryDto) {
    return this.queryService.listAttempts(query);
  }

  @Get('dlq')
  listDlq(@Query() query: ListDlqQueryDto) {
    return this.queryService.listDlq(query);
  }

  @Post('events/test')
  publishTestEvent(@Body() dto: PublishTestEventDto) {
    return this.pipelineService.publishTestEvent({
      eventId: dto.eventId ?? randomUUID(),
      eventType: dto.eventType,
      occurredAt: new Date().toISOString(),
      aggregateType: dto.aggregateType,
      aggregateId: dto.aggregateId,
      initiatorUserId: dto.initiatorUserId ?? null,
      version: 1,
      payload: dto.payload,
    });
  }

  @Post('dlq/:id/replay')
  replayDlq(@Param('id') id: string) {
    return this.pipelineService.replayDlqRecord(id);
  }
}
