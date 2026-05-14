import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appConfig } from '../../../config/app.config';
import { OutboxStatus } from '../../../common/types/outbox-status.enum';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { KafkaService } from './kafka.service';
import { DomainEventMessage } from '../types/domain-event.type';

@Injectable()
export class OutboxProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    @InjectRepository(OutboxEventEntity)
    private readonly outboxRepository: Repository<OutboxEventEntity>,
    private readonly kafkaService: KafkaService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!appConfig.notifications.pipelineEnabled) {
      return;
    }

    void this.start();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async flushPendingEvents(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const pending = await this.outboxRepository.find({
        where: { status: OutboxStatus.PENDING },
        order: { createdAt: 'ASC' },
        take: 50,
      });

      for (const event of pending) {
        // В Kafka уходит нормализованное доменное событие с единым контрактом.
        const payload: DomainEventMessage = {
          eventId: event.eventId,
          eventType: event.eventType,
          occurredAt: event.createdAt.toISOString(),
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          initiatorUserId: event.initiatorUserId,
          version: 1,
          payload: event.payload,
        };

        await this.kafkaService.publish(appConfig.kafka.topicDomainEvents, event.eventId, payload);
        event.status = OutboxStatus.PUBLISHED;
        event.publishedAt = new Date();
        await this.outboxRepository.save(event);
      }
    } catch (error) {
      this.logger.error(`Outbox flush failed: ${this.getErrorMessage(error)}`);
    } finally {
      this.isRunning = false;
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  private async start(): Promise<void> {
    try {
      await this.kafkaService.ensureTopics();
      // Outbox публикуется отдельным процессом, а не напрямую из бизнес-сервисов.
      this.timer = setInterval(() => {
        void this.flushPendingEvents();
      }, appConfig.notifications.outboxPollIntervalMs);
      void this.flushPendingEvents();
    } catch (error) {
      this.logger.error(`Outbox processor start failed: ${this.getErrorMessage(error)}`);
      setTimeout(() => {
        void this.start();
      }, 3000);
    }
  }
}
