import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationsPipeline1711000000000 implements MigrationInterface {
  name = 'AddNotificationsPipeline1711000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."outbox_events_status_enum" AS ENUM ('pending', 'published');
      CREATE TYPE "public"."incoming_events_status_enum" AS ENUM ('processed', 'duplicate', 'invalid', 'dlq');
      CREATE TYPE "public"."notifications_channel_enum" AS ENUM ('internal', 'email');
      CREATE TYPE "public"."notifications_status_enum" AS ENUM ('pending', 'sent', 'failed', 'suppressed');
      CREATE TYPE "public"."notification_delivery_attempts_status_enum" AS ENUM ('success', 'retry', 'failed', 'suppressed');
      CREATE TYPE "public"."dlq_records_status_enum" AS ENUM ('open', 'replayed');

      CREATE TABLE "outbox_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "event_type" character varying(120) NOT NULL,
        "aggregate_type" character varying(120) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "initiator_user_id" uuid,
        "payload" jsonb NOT NULL,
        "status" "public"."outbox_events_status_enum" NOT NULL DEFAULT 'pending',
        "published_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbox_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_outbox_events_event_id" UNIQUE ("event_id")
      );

      CREATE TABLE "incoming_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "event_type" character varying(120) NOT NULL,
        "aggregate_type" character varying(120) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "status" "public"."incoming_events_status_enum" NOT NULL,
        "source_topic" character varying(160) NOT NULL,
        "payload" jsonb NOT NULL,
        "error_message" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_incoming_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_incoming_events_event_id" UNIQUE ("event_id")
      );

      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "notification_type" character varying(120) NOT NULL,
        "channel" "public"."notifications_channel_enum" NOT NULL,
        "recipient_user_id" uuid NOT NULL,
        "recipient_address" character varying(255) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "public"."notifications_status_enum" NOT NULL DEFAULT 'pending',
        "suppressed_reason" character varying(255),
        "sent_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
      );

      CREATE TABLE "notification_delivery_attempts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "notification_id" uuid NOT NULL,
        "attempt_number" integer NOT NULL,
        "status" "public"."notification_delivery_attempts_status_enum" NOT NULL,
        "provider" character varying(120) NOT NULL,
        "error_code" character varying(120),
        "error_message" text,
        "processed_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_delivery_attempts_id" PRIMARY KEY ("id")
      );

      CREATE TABLE "dlq_records" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "message_key" character varying(255),
        "source_topic" character varying(160) NOT NULL,
        "target_topic" character varying(160) NOT NULL,
        "message_type" character varying(120) NOT NULL,
        "reason_code" character varying(120) NOT NULL,
        "reason_message" text NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "public"."dlq_records_status_enum" NOT NULL DEFAULT 'open',
        "replayed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dlq_records_id" PRIMARY KEY ("id")
      );

      CREATE INDEX "IDX_notifications_event_id" ON "notifications" ("event_id");
      CREATE INDEX "IDX_notifications_recipient_user_id" ON "notifications" ("recipient_user_id");

      ALTER TABLE "notification_delivery_attempts"
        ADD CONSTRAINT "FK_notification_delivery_attempts_notification_id"
        FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification_delivery_attempts"
        DROP CONSTRAINT "FK_notification_delivery_attempts_notification_id";

      DROP INDEX "public"."IDX_notifications_recipient_user_id";
      DROP INDEX "public"."IDX_notifications_event_id";

      DROP TABLE "dlq_records";
      DROP TABLE "notification_delivery_attempts";
      DROP TABLE "notifications";
      DROP TABLE "incoming_events";
      DROP TABLE "outbox_events";

      DROP TYPE "public"."dlq_records_status_enum";
      DROP TYPE "public"."notification_delivery_attempts_status_enum";
      DROP TYPE "public"."notifications_status_enum";
      DROP TYPE "public"."notifications_channel_enum";
      DROP TYPE "public"."incoming_events_status_enum";
      DROP TYPE "public"."outbox_events_status_enum";
    `);
  }
}
