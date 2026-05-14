import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../../../common/types/notification-channel.enum';
import { NotificationDeliveryCommand } from '../types/domain-event.type';

export class TemporaryDeliveryError extends Error {}
export class PermanentDeliveryError extends Error {}

@Injectable()
export class NotificationDeliveryService {
  async deliver(command: NotificationDeliveryCommand): Promise<{ provider: string }> {
    const forcePermanentFailure = command.payload.forcePermanentFailure === true;
    const forceTemporaryFailure = command.payload.forceTemporaryFailure === true;

    if (forcePermanentFailure) {
      throw new PermanentDeliveryError('Permanent delivery failure requested by payload');
    }

    if (forceTemporaryFailure && command.attemptNumber < 3) {
      throw new TemporaryDeliveryError('Temporary delivery failure requested by payload');
    }

    if (
      command.channel === NotificationChannel.EMAIL &&
      typeof command.recipientAddress === 'string' &&
      command.recipientAddress.includes('+fail@')
    ) {
      throw new TemporaryDeliveryError('Email provider temporary failure');
    }

    return {
      provider: command.channel === NotificationChannel.EMAIL ? 'fake-email-provider' : 'internal-feed',
    };
  }
}
