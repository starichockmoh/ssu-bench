import { NotificationChannel } from '../../../common/types/notification-channel.enum';

export interface DomainEventPayload extends Record<string, unknown> {
  [key: string]: unknown;
}

export interface DomainEventMessage extends Record<string, unknown> {
  eventId: string;
  eventType: string;
  occurredAt: string;
  aggregateType: string;
  aggregateId: string;
  initiatorUserId: string | null;
  version: number;
  payload: DomainEventPayload;
}

export interface NotificationCreateCommand extends Record<string, unknown> {
  commandId: string;
  eventId: string;
  notificationType: string;
  recipientUserId: string;
  channel: NotificationChannel;
  recipientAddress: string;
  payload: Record<string, unknown>;
}

export interface NotificationDeliveryCommand extends Record<string, unknown> {
  commandId: string;
  notificationId: string;
  eventId: string;
  notificationType: string;
  recipientUserId: string;
  channel: NotificationChannel;
  recipientAddress: string;
  attemptNumber: number;
  payload: Record<string, unknown>;
}

export interface DlqEnvelope extends Record<string, unknown> {
  sourceTopic: string;
  targetTopic: string;
  messageKey: string | null;
  messageType: string;
  reasonCode: string;
  reasonMessage: string;
  payload: Record<string, unknown>;
}
