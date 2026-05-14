import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindManyOptions, MoreThanOrEqual, LessThanOrEqual, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { getPagination } from '../../../common/utils/pagination';
import { IncomingEventEntity } from '../entities/incoming-event.entity';
import { NotificationEntity } from '../entities/notification.entity';
import { NotificationDeliveryAttemptEntity } from '../entities/notification-delivery-attempt.entity';
import { DlqRecordEntity } from '../entities/dlq-record.entity';
import { ListEventsQueryDto } from '../dto/list-events-query.dto';
import { ListNotificationsQueryDto } from '../dto/list-notifications-query.dto';
import { ListDeliveriesQueryDto } from '../dto/list-deliveries-query.dto';
import { ListDlqQueryDto } from '../dto/list-dlq-query.dto';

@Injectable()
export class NotificationsQueryService {
  constructor(
    @InjectRepository(IncomingEventEntity)
    private readonly incomingEventsRepository: Repository<IncomingEventEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    @InjectRepository(NotificationDeliveryAttemptEntity)
    private readonly attemptsRepository: Repository<NotificationDeliveryAttemptEntity>,
    @InjectRepository(DlqRecordEntity)
    private readonly dlqRepository: Repository<DlqRecordEntity>,
  ) {}

  async listIncomingEvents(query: ListEventsQueryDto): Promise<PaginatedResponseDto<IncomingEventEntity>> {
    const { page, limit, skip } = getPagination(query);
    const [items, total] = await this.incomingEventsRepository.findAndCount({
      where: this.buildDateWhere(
        {
          ...(query.eventId ? { eventId: query.eventId } : {}),
          ...(query.eventType ? { eventType: query.eventType } : {}),
          ...(query.status ? { status: query.status } : {}),
        },
        query.from,
        query.to,
      ),
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async listNotifications(query: ListNotificationsQueryDto): Promise<PaginatedResponseDto<NotificationEntity>> {
    const { page, limit, skip } = getPagination(query);
    const [items, total] = await this.notificationsRepository.findAndCount({
      where: this.buildDateWhere(
        {
          ...(query.recipientUserId ? { recipientUserId: query.recipientUserId } : {}),
          ...(query.channel ? { channel: query.channel } : {}),
          ...(query.notificationType ? { notificationType: query.notificationType } : {}),
          ...(query.status ? { status: query.status } : {}),
        },
        query.from,
        query.to,
      ),
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async listAttempts(
    query: ListDeliveriesQueryDto,
  ): Promise<PaginatedResponseDto<NotificationDeliveryAttemptEntity>> {
    const { page, limit, skip } = getPagination(query);
    const [items, total] = await this.attemptsRepository.findAndCount({
      where: this.buildDateWhere(
        {
          ...(query.notificationId ? { notificationId: query.notificationId } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.provider ? { provider: query.provider } : {}),
        },
        query.from,
        query.to,
        'processedAt',
      ),
      order: { processedAt: 'DESC' },
      relations: { notification: true },
      skip,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async listDlq(query: ListDlqQueryDto): Promise<PaginatedResponseDto<DlqRecordEntity>> {
    const { page, limit, skip } = getPagination(query);
    const [items, total] = await this.dlqRepository.findAndCount({
      where: this.buildDateWhere(
        {
          ...(query.reasonCode ? { reasonCode: query.reasonCode } : {}),
          ...(query.messageType ? { messageType: query.messageType } : {}),
          ...(query.status ? { status: query.status } : {}),
        },
        query.from,
        query.to,
      ),
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { items, total, page, limit };
  }

  private buildDateWhere(
    base: Record<string, unknown>,
    from?: string,
    to?: string,
    field: 'createdAt' | 'processedAt' = 'createdAt',
  ): FindManyOptions['where'] {
    const where = { ...base } as Record<string, unknown>;

    if (from && to) {
      where[field] = Between(new Date(from), new Date(to));
    } else if (from) {
      where[field] = MoreThanOrEqual(new Date(from));
    } else if (to) {
      where[field] = LessThanOrEqual(new Date(to));
    }

    return where;
  }
}
