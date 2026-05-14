import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import {
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { appConfig } from '../../../config/app.config';
import { DeliveryAttemptStatus } from '../../../common/types/delivery-attempt-status.enum';
import { DlqStatus } from '../../../common/types/dlq-status.enum';
import { IncomingEventStatus } from '../../../common/types/incoming-event-status.enum';
import { NotificationStatus } from '../../../common/types/notification-status.enum';
import { NotificationEntity } from '../entities/notification.entity';
import { NotificationDeliveryAttemptEntity } from '../entities/notification-delivery-attempt.entity';
import { IncomingEventEntity } from '../entities/incoming-event.entity';
import { DlqRecordEntity } from '../entities/dlq-record.entity';
import {
  DlqEnvelope,
  DomainEventMessage,
  NotificationCreateCommand,
  NotificationDeliveryCommand,
} from '../types/domain-event.type';
import { KafkaService } from './kafka.service';
import { NotificationRoutingService } from './notification-routing.service';
import {
  NotificationDeliveryService,
  PermanentDeliveryError,
  TemporaryDeliveryError,
} from './notification-delivery.service';

@Injectable()
export class NotificationsPipelineService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsPipelineService.name);

  constructor(
    @InjectRepository(IncomingEventEntity)
    private readonly incomingEventsRepository: Repository<IncomingEventEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    @InjectRepository(NotificationDeliveryAttemptEntity)
    private readonly attemptsRepository: Repository<NotificationDeliveryAttemptEntity>,
    @InjectRepository(DlqRecordEntity)
    private readonly dlqRepository: Repository<DlqRecordEntity>,
    private readonly kafkaService: KafkaService,
    private readonly routingService: NotificationRoutingService,
    private readonly deliveryService: NotificationDeliveryService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!appConfig.notifications.pipelineEnabled) {
      return;
    }

    void this.startConsumers();
  }

  async publishTestEvent(
    event: DomainEventMessage,
  ): Promise<{ outbox: boolean; eventId: string }> {
    await this.kafkaService.publish(appConfig.kafka.topicDomainEvents, event.eventId, event);
    return { outbox: false, eventId: event.eventId };
  }

  async replayDlqRecord(id: string): Promise<DlqRecordEntity> {
    const record = await this.dlqRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException({
        code: 'DLQ_RECORD_NOT_FOUND',
        message: 'DLQ record not found',
      });
    }

    await this.kafkaService.publish(record.targetTopic, record.messageKey ?? randomUUID(), record.payload);
    record.status = DlqStatus.REPLAYED;
    record.replayedAt = new Date();
    return this.dlqRepository.save(record);
  }

  private async processDomainEventMessage(topic: string, key: string | null, raw: string): Promise<void> {
    let event: DomainEventMessage;

    try {
      event = JSON.parse(raw) as DomainEventMessage;
      this.validateDomainEvent(event);
    } catch (error) {
      await this.writeDlq({
        sourceTopic: topic,
        targetTopic: appConfig.kafka.topicDomainEvents,
        messageKey: key,
        messageType: 'domain-event',
        reasonCode: 'INVALID_EVENT',
        reasonMessage: this.getErrorMessage(error),
        payload: this.parseRawPayload(raw),
      });
      return;
    }

    const isDuplicate = await this.incomingEventsRepository.findOne({
      where: { eventId: event.eventId },
    });
    // Защита от повторной обработки при повторной доставке сообщения из Kafka.
    if (isDuplicate) {
      return;
    }

    try {
      await this.incomingEventsRepository.save(
        this.incomingEventsRepository.create({
          eventId: event.eventId,
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          sourceTopic: topic,
          status: IncomingEventStatus.PROCESSED,
          payload: event.payload,
          errorMessage: null,
        }),
      );

      const commands = await this.routingService.buildCommands(event);
      for (const command of commands) {
        await this.kafkaService.publish(appConfig.kafka.topicNotificationCreateCommands, command.commandId, command);
      }
    } catch (error) {
      await this.writeDlq({
        sourceTopic: topic,
        targetTopic: appConfig.kafka.topicDomainEvents,
        messageKey: key ?? event.eventId,
        messageType: event.eventType,
        reasonCode: 'EVENT_PROCESSING_FAILED',
        reasonMessage: this.getErrorMessage(error),
        payload: event as unknown as Record<string, unknown>,
      });
    }
  }

  private async processCreateCommandMessage(topic: string, key: string | null, raw: string): Promise<void> {
    let command: NotificationCreateCommand;

    try {
      command = JSON.parse(raw) as NotificationCreateCommand;
      this.validateCreateCommand(command);
    } catch (error) {
      await this.writeDlq({
        sourceTopic: topic,
        targetTopic: appConfig.kafka.topicNotificationCreateCommands,
        messageKey: key,
        messageType: 'notification-create-command',
        reasonCode: 'INVALID_CREATE_COMMAND',
        reasonMessage: this.getErrorMessage(error),
        payload: this.parseRawPayload(raw),
      });
      return;
    }

    const existing = await this.notificationsRepository.findOne({
      where: {
        eventId: command.eventId,
        recipientUserId: command.recipientUserId,
        channel: command.channel,
        notificationType: command.notificationType,
      },
    });

    if (existing) {
      return;
    }

    const notification = await this.notificationsRepository.save(
      this.notificationsRepository.create({
        eventId: command.eventId,
        notificationType: command.notificationType,
        recipientUserId: command.recipientUserId,
        channel: command.channel,
        recipientAddress: command.recipientAddress,
        payload: command.payload,
        status: NotificationStatus.PENDING,
        suppressedReason: null,
        sentAt: null,
      }),
    );

    const rateLimitThreshold = new Date(
      Date.now() - appConfig.notifications.rateLimitWindowSeconds * 1000,
    );
    const duplicate = await this.notificationsRepository.findOne({
      where: {
        recipientUserId: command.recipientUserId,
        channel: command.channel,
        notificationType: command.notificationType,
        status: NotificationStatus.SENT,
        sentAt: MoreThanOrEqual(rateLimitThreshold),
      },
      order: { sentAt: 'DESC' },
    });

    // Ограничиваем частоту одинаковых уведомлений по пользователю и каналу.
    if (duplicate) {
      notification.status = NotificationStatus.SUPPRESSED;
      notification.suppressedReason = 'RATE_LIMITED';
      await this.notificationsRepository.save(notification);
      await this.attemptsRepository.save(
        this.attemptsRepository.create({
          notificationId: notification.id,
          attemptNumber: 0,
          status: DeliveryAttemptStatus.SUPPRESSED,
          provider: command.channel,
          errorCode: 'RATE_LIMITED',
          errorMessage: 'Notification suppressed by rate limit',
        }),
      );
      return;
    }

    const deliveryCommand: NotificationDeliveryCommand = {
      commandId: randomUUID(),
      notificationId: notification.id,
      eventId: notification.eventId,
      notificationType: notification.notificationType,
      recipientUserId: notification.recipientUserId,
      channel: notification.channel,
      recipientAddress: notification.recipientAddress,
      attemptNumber: 1,
      payload: notification.payload,
    };

    await this.kafkaService.publish(
      appConfig.kafka.topicNotificationDeliveryCommands,
      deliveryCommand.commandId,
      deliveryCommand,
    );
  }

  private async processDeliveryCommandMessage(topic: string, key: string | null, raw: string): Promise<void> {
    let command: NotificationDeliveryCommand;

    try {
      command = JSON.parse(raw) as NotificationDeliveryCommand;
      this.validateDeliveryCommand(command);
    } catch (error) {
      await this.writeDlq({
        sourceTopic: topic,
        targetTopic: appConfig.kafka.topicNotificationDeliveryCommands,
        messageKey: key,
        messageType: 'notification-delivery-command',
        reasonCode: 'INVALID_DELIVERY_COMMAND',
        reasonMessage: this.getErrorMessage(error),
        payload: this.parseRawPayload(raw),
      });
      return;
    }

    const notification = await this.notificationsRepository.findOne({
      where: { id: command.notificationId },
    });
    if (!notification) {
      await this.writeDlq({
        sourceTopic: topic,
        targetTopic: appConfig.kafka.topicNotificationDeliveryCommands,
        messageKey: key ?? command.commandId,
        messageType: 'notification-delivery-command',
        reasonCode: 'NOTIFICATION_NOT_FOUND',
        reasonMessage: 'Notification not found',
        payload: command as unknown as Record<string, unknown>,
      });
      return;
    }

    if ([NotificationStatus.SENT, NotificationStatus.SUPPRESSED].includes(notification.status)) {
      return;
    }

    try {
      const deliveryResult = await this.deliveryService.deliver(command);
      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
      notification.suppressedReason = null;
      await this.notificationsRepository.save(notification);
      await this.attemptsRepository.save(
        this.attemptsRepository.create({
          notificationId: notification.id,
          attemptNumber: command.attemptNumber,
          status: DeliveryAttemptStatus.SUCCESS,
          provider: deliveryResult.provider,
          errorCode: null,
          errorMessage: null,
        }),
      );
    } catch (error) {
      const provider = command.channel;
      const isTemporary = error instanceof TemporaryDeliveryError;
      const isPermanent = error instanceof PermanentDeliveryError;

      if (isTemporary && command.attemptNumber < 3) {
        await this.attemptsRepository.save(
          this.attemptsRepository.create({
            notificationId: notification.id,
            attemptNumber: command.attemptNumber,
            status: DeliveryAttemptStatus.RETRY,
            provider,
            errorCode: 'TEMPORARY_DELIVERY_ERROR',
            errorMessage: this.getErrorMessage(error),
          }),
        );

        // Повторная попытка идёт через отдельный retry-topic, чтобы пайплайн оставался явным.
        await this.delayRetryTopic(topic);
        const nextAttempt = command.attemptNumber + 1;
        const nextTopic = this.getRetryTopic(nextAttempt);
        await this.kafkaService.publish(nextTopic, command.commandId, {
          ...command,
          attemptNumber: nextAttempt,
        });
        return;
      }

      notification.status = NotificationStatus.FAILED;
      await this.notificationsRepository.save(notification);
      await this.attemptsRepository.save(
        this.attemptsRepository.create({
          notificationId: notification.id,
          attemptNumber: command.attemptNumber,
          status: DeliveryAttemptStatus.FAILED,
          provider,
          errorCode: isPermanent ? 'PERMANENT_DELIVERY_ERROR' : 'DELIVERY_ERROR',
          errorMessage: this.getErrorMessage(error),
        }),
      );

      await this.writeDlq({
        sourceTopic: topic,
        targetTopic: appConfig.kafka.topicNotificationDeliveryCommands,
        messageKey: key ?? command.commandId,
        messageType: 'notification-delivery-command',
        reasonCode: isPermanent ? 'PERMANENT_DELIVERY_ERROR' : 'DELIVERY_FAILED',
        reasonMessage: this.getErrorMessage(error),
        payload: command as unknown as Record<string, unknown>,
      });
    }
  }

  private async writeDlq(envelope: DlqEnvelope): Promise<void> {
    // Дублируем запись в БД, чтобы DLQ можно было просматривать и переигрывать через API.
    await this.dlqRepository.save(
      this.dlqRepository.create({
        messageKey: envelope.messageKey,
        sourceTopic: envelope.sourceTopic,
        targetTopic: envelope.targetTopic,
        messageType: envelope.messageType,
        reasonCode: envelope.reasonCode,
        reasonMessage: envelope.reasonMessage,
        payload: envelope.payload,
        status: DlqStatus.OPEN,
        replayedAt: null,
      }),
    );

    await this.kafkaService.publishDlq(envelope);
  }

  private validateDomainEvent(event: DomainEventMessage): void {
    if (
      !event ||
      !event.eventId ||
      !event.eventType ||
      !event.aggregateType ||
      !event.aggregateId ||
      !event.occurredAt ||
      !event.payload
    ) {
      throw new Error('Domain event is missing required fields');
    }
  }

  private validateCreateCommand(command: NotificationCreateCommand): void {
    if (
      !command ||
      !command.commandId ||
      !command.eventId ||
      !command.notificationType ||
      !command.recipientUserId ||
      !command.channel
    ) {
      throw new Error('Notification create command is missing required fields');
    }
  }

  private validateDeliveryCommand(command: NotificationDeliveryCommand): void {
    if (
      !command ||
      !command.commandId ||
      !command.notificationId ||
      !command.eventId ||
      !command.notificationType ||
      !command.channel ||
      typeof command.attemptNumber !== 'number'
    ) {
      throw new Error('Notification delivery command is missing required fields');
    }
  }

  private async delayRetryTopic(topic: string): Promise<void> {
    const delayMs =
      topic === appConfig.kafka.topicRetry1
        ? appConfig.notifications.retryDelaysMs[1]
        : topic === appConfig.kafka.topicRetry2
          ? appConfig.notifications.retryDelaysMs[2]
          : appConfig.notifications.retryDelaysMs[0];

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private getRetryTopic(attemptNumber: number): string {
    if (attemptNumber === 2) {
      return appConfig.kafka.topicRetry1;
    }

    if (attemptNumber === 3) {
      return appConfig.kafka.topicRetry2;
    }

    return appConfig.kafka.topicRetry3;
  }

  private parseRawPayload(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { raw };
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  private async startConsumers(): Promise<void> {
    try {
      await this.kafkaService.ensureTopics();

      // Первая consumer group: валидация, дедупликация и генерация команд.
      await this.kafkaService.createConsumer(
        appConfig.kafka.consumerGroupValidation,
        [appConfig.kafka.topicDomainEvents, appConfig.kafka.topicNotificationCreateCommands],
        async (message) => {
          if (message.topic === appConfig.kafka.topicDomainEvents) {
            await this.processDomainEventMessage(message.topic, message.key, message.value);
            return;
          }

          await this.processCreateCommandMessage(message.topic, message.key, message.value);
        },
      );

      // Вторая consumer group: доставка, retry и финальная маршрутизация ошибок в DLQ.
      await this.kafkaService.createConsumer(
        appConfig.kafka.consumerGroupDelivery,
        [
          appConfig.kafka.topicNotificationDeliveryCommands,
          appConfig.kafka.topicRetry1,
          appConfig.kafka.topicRetry2,
          appConfig.kafka.topicRetry3,
        ],
        async (message) => {
          await this.processDeliveryCommandMessage(message.topic, message.key, message.value);
        },
      );
    } catch (error) {
      this.logger.error(`Notifications pipeline start failed: ${this.getErrorMessage(error)}`);
      setTimeout(() => {
        void this.startConsumers();
      }, 3000);
    }
  }
}
