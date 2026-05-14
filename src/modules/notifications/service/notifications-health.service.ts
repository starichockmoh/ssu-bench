import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { appConfig } from '../../../config/app.config';
import { KafkaService } from './kafka.service';

@Injectable()
export class NotificationsHealthService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly kafkaService: KafkaService,
  ) {}

  async getHealth(): Promise<Record<string, unknown>> {
    let database = false;
    try {
      await this.dataSource.query('SELECT 1');
      database = true;
    } catch {
      database = false;
    }

    const kafka = appConfig.notifications.pipelineEnabled ? await this.kafkaService.ping() : false;

    return {
      status: database && (kafka || !appConfig.notifications.pipelineEnabled) ? 'ok' : 'degraded',
      app: true,
      database,
      kafka,
      notificationsPipelineEnabled: appConfig.notifications.pipelineEnabled,
    };
  }
}
