import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { OutboxStatus } from '../../../common/types/outbox-status.enum';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { DomainEventPayload } from '../types/domain-event.type';

interface AppendDomainEventParams {
  manager: EntityManager;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  initiatorUserId?: string | null;
  payload: DomainEventPayload;
  eventId?: string;
}

@Injectable()
export class DomainEventsService {
  async appendEvent(params: AppendDomainEventParams): Promise<OutboxEventEntity> {
    const repository = params.manager.getRepository(OutboxEventEntity);

    // Событие пишется в той же транзакции, что и бизнес-изменение.
    const event = repository.create({
      eventId: params.eventId ?? randomUUID(),
      eventType: params.eventType,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      initiatorUserId: params.initiatorUserId ?? null,
      payload: params.payload,
      status: OutboxStatus.PENDING,
      publishedAt: null,
    });

    return repository.save(event);
  }
}
