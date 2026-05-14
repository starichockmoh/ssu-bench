import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationChannel } from '../../../common/types/notification-channel.enum';
import { UserRole } from '../../../common/types/role.enum';
import { UserEntity } from '../../users/entities/user.entity';
import { DomainEventMessage, NotificationCreateCommand } from '../types/domain-event.type';
import { NotificationEventType } from '../constants/event-types';

type Recipient = {
  userId: string;
  notificationType: string;
  channels: NotificationChannel[];
  addressEmail: string;
  payload: Record<string, unknown>;
};

@Injectable()
export class NotificationRoutingService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async buildCommands(event: DomainEventMessage): Promise<NotificationCreateCommand[]> {
    const recipients = await this.resolveRecipients(event);

    // Одно доменное событие может породить несколько уведомлений и каналов доставки.
    return recipients.flatMap((recipient) =>
      recipient.channels.map((channel) => ({
        commandId: randomUUID(),
        eventId: event.eventId,
        notificationType: recipient.notificationType,
        recipientUserId: recipient.userId,
        channel,
        recipientAddress: channel === NotificationChannel.EMAIL ? recipient.addressEmail : `user:${recipient.userId}`,
        payload: recipient.payload,
      })),
    );
  }

  private async resolveRecipients(event: DomainEventMessage): Promise<Recipient[]> {
    const payload = event.payload;
    const customerId = this.getString(payload.customerId);
    const contractorId = this.getString(payload.contractorId);
    const blockedUserId = this.getString(payload.userId);
    const adminUsers = await this.usersRepository.find({
      where: { role: UserRole.ADMIN },
    });

    // Правила маршрутизации держим централизованно, чтобы расширять события без правок pipeline.
    switch (event.eventType) {
      case NotificationEventType.TaskCreated: {
        return adminUsers.map((user) => ({
          userId: user.id,
          notificationType: event.eventType,
          channels: [NotificationChannel.INTERNAL, NotificationChannel.EMAIL],
          addressEmail: user.email,
          payload,
        }));
      }
      case NotificationEventType.BidCreated: {
        const customer = await this.loadUser(customerId, 'Customer not found for bid event');
        return [this.asRecipient(customer.id, customer.email, event.eventType, payload)];
      }
      case NotificationEventType.BidSelected: {
        const contractor = await this.loadUser(contractorId, 'Contractor not found for bid selection event');
        return [this.asRecipient(contractor.id, contractor.email, event.eventType, payload)];
      }
      case NotificationEventType.TaskCompletedByContractor: {
        const customer = await this.loadUser(customerId, 'Customer not found for task completion event');
        return [this.asRecipient(customer.id, customer.email, event.eventType, payload)];
      }
      case NotificationEventType.TaskConfirmed: {
        const contractor = await this.loadUser(contractorId, 'Contractor not found for task confirmation event');
        const customer = await this.loadUser(customerId, 'Customer not found for task confirmation event');
        return [
          this.asRecipient(contractor.id, contractor.email, event.eventType, payload),
          this.asRecipient(customer.id, customer.email, event.eventType, payload),
        ];
      }
      case NotificationEventType.PaymentCompleted: {
        const customer = await this.loadUser(customerId, 'Customer not found for payment event');
        const contractor = await this.loadUser(contractorId, 'Contractor not found for payment event');
        return [
          this.asRecipient(customer.id, customer.email, event.eventType, payload),
          this.asRecipient(contractor.id, contractor.email, event.eventType, payload),
        ];
      }
      case NotificationEventType.UserBlocked: {
        const blocked = await this.loadUser(blockedUserId, 'User not found for block event');
        return [this.asRecipient(blocked.id, blocked.email, event.eventType, payload)];
      }
      case NotificationEventType.TechnicalTest: {
        const recipientId = this.getString(payload.recipientUserId);
        const user = await this.loadUser(recipientId, 'Recipient not found for technical test event');
        return [this.asRecipient(user.id, user.email, event.eventType, payload)];
      }
      default:
        return [];
    }
  }

  private asRecipient(
    userId: string,
    email: string,
    notificationType: string,
    payload: Record<string, unknown>,
  ): Recipient {
    return {
      userId,
      notificationType,
      channels: [NotificationChannel.INTERNAL, NotificationChannel.EMAIL],
      addressEmail: email,
      payload,
    };
  }

  private async loadUser(userId: string | null, message: string): Promise<UserEntity> {
    if (!userId) {
      throw new NotFoundException(message);
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(message);
    }

    return user;
  }

  private getString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}
