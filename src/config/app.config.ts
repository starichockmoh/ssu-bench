import 'dotenv/config';

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const toList = (value: string | undefined, fallback: string[]): string[] => {
  if (!value) {
    return fallback;
  }

  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : fallback;
};

export const appConfig = {
  port: toNumber(process.env.PORT, 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toNumber(process.env.DB_PORT, 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'ssu_bench',
  },
  timeouts: {
    keepAlive: toNumber(process.env.HTTP_KEEP_ALIVE_TIMEOUT, 65000),
    headers: toNumber(process.env.HTTP_HEADERS_TIMEOUT, 66000),
    request: toNumber(process.env.HTTP_REQUEST_TIMEOUT, 30000),
  },
  notifications: {
    pipelineEnabled: toBoolean(process.env.NOTIFICATIONS_PIPELINE_ENABLED, process.env.NODE_ENV !== 'test'),
    outboxPollIntervalMs: toNumber(process.env.OUTBOX_POLL_INTERVAL_MS, 1000),
    retryDelaysMs: [
      toNumber(process.env.NOTIFICATIONS_RETRY_DELAY_1_MS, 5000),
      toNumber(process.env.NOTIFICATIONS_RETRY_DELAY_2_MS, 15000),
      toNumber(process.env.NOTIFICATIONS_RETRY_DELAY_3_MS, 30000),
    ],
    rateLimitWindowSeconds: toNumber(process.env.NOTIFICATIONS_RATE_LIMIT_WINDOW_SECONDS, 60),
  },
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID ?? 'ssu-bench',
    brokers: toList(process.env.KAFKA_BROKERS, ['localhost:9092']),
    topicDomainEvents: process.env.KAFKA_TOPIC_DOMAIN_EVENTS ?? 'ssu.domain.events',
    topicNotificationCreateCommands:
      process.env.KAFKA_TOPIC_NOTIFICATION_CREATE_COMMANDS ?? 'ssu.notifications.commands.create',
    topicNotificationDeliveryCommands:
      process.env.KAFKA_TOPIC_NOTIFICATION_DELIVERY_COMMANDS ?? 'ssu.notifications.commands.deliver',
    topicRetry1: process.env.KAFKA_TOPIC_NOTIFICATION_RETRY_1 ?? 'ssu.notifications.retry.1',
    topicRetry2: process.env.KAFKA_TOPIC_NOTIFICATION_RETRY_2 ?? 'ssu.notifications.retry.2',
    topicRetry3: process.env.KAFKA_TOPIC_NOTIFICATION_RETRY_3 ?? 'ssu.notifications.retry.3',
    topicDlq: process.env.KAFKA_TOPIC_NOTIFICATION_DLQ ?? 'ssu.notifications.dlq',
    consumerGroupValidation:
      process.env.KAFKA_CONSUMER_GROUP_VALIDATION ?? 'ssu-notifications-validation',
    consumerGroupDelivery:
      process.env.KAFKA_CONSUMER_GROUP_DELIVERY ?? 'ssu-notifications-delivery',
  },
};
