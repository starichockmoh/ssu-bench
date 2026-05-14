import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Consumer, EachMessagePayload, Kafka, KafkaConfig, Producer, logLevel } from 'kafkajs';
import { appConfig } from '../../../config/app.config';
import { DlqEnvelope } from '../types/domain-event.type';

type MessageHandler = (input: {
  topic: string;
  key: string | null;
  value: string;
}) => Promise<void>;

@Injectable()
export class KafkaService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private readonly kafka: Kafka;
  private producer: Producer | null = null;
  private readonly consumers: Consumer[] = [];
  private adminConnected = false;

  constructor() {
    const config: KafkaConfig = {
      clientId: appConfig.kafka.clientId,
      brokers: appConfig.kafka.brokers,
      logLevel: logLevel.NOTHING,
    };

    this.kafka = new Kafka(config);
  }

  async ensureTopics(): Promise<void> {
    const admin = this.kafka.admin();
    const topics = [
      appConfig.kafka.topicDomainEvents,
      appConfig.kafka.topicNotificationCreateCommands,
      appConfig.kafka.topicNotificationDeliveryCommands,
      appConfig.kafka.topicRetry1,
      appConfig.kafka.topicRetry2,
      appConfig.kafka.topicRetry3,
      appConfig.kafka.topicDlq,
    ];

    try {
      await admin.connect();
      this.adminConnected = true;
      await admin.createTopics({
        waitForLeaders: true,
        topics: topics.map((topic) => ({ topic })),
      });
      await this.waitForTopicsReady(admin, topics);
    } finally {
      if (this.adminConnected) {
        await admin.disconnect();
        this.adminConnected = false;
      }
    }
  }

  async publish(topic: string, key: string, value: Record<string, unknown>): Promise<void> {
    const producer = await this.getProducer();
    await producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(value) }],
    });
  }

  async publishDlq(envelope: DlqEnvelope): Promise<void> {
    await this.publish(appConfig.kafka.topicDlq, envelope.messageKey ?? envelope.reasonCode, envelope);
  }

  async createConsumer(groupId: string, topics: string[], handler: MessageHandler): Promise<void> {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();

    for (const topic of topics) {
      await consumer.subscribe({ topic, fromBeginning: false });
    }

    await consumer.run({
      eachMessage: async ({ topic, message }: EachMessagePayload) => {
        if (!message.value) {
          return;
        }

        await handler({
          topic,
          key: message.key?.toString() ?? null,
          value: message.value.toString(),
        });
      },
    });

    this.consumers.push(consumer);
  }

  async ping(): Promise<boolean> {
    const admin = this.kafka.admin();

    try {
      await admin.connect();
      await admin.fetchTopicMetadata();
      return true;
    } catch (error) {
      this.logger.error(`Kafka healthcheck failed: ${this.getErrorMessage(error)}`);
      return false;
    } finally {
      try {
        await admin.disconnect();
      } catch {
        // noop
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
    }

    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
  }

  private async getProducer(): Promise<Producer> {
    if (this.producer) {
      return this.producer;
    }

    this.producer = this.kafka.producer();
    await this.producer.connect();
    return this.producer;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  private async waitForTopicsReady(
    admin: {
      fetchTopicMetadata: (input: { topics: string[] }) => Promise<{
        topics: Array<{ name: string; partitions: Array<unknown> }>;
      }>;
    },
    topics: string[],
  ): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const metadata = await admin.fetchTopicMetadata({ topics });
      const readyCount = metadata.topics.filter((topic) => topic.partitions.length > 0).length;

      if (readyCount === topics.length) {
        return;
      }

      await this.sleep(1000);
    }

    throw new Error('Kafka topics were not fully ready after creation');
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
