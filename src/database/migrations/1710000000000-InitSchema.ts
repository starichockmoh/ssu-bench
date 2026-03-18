import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1710000000000 implements MigrationInterface {
  name = 'InitSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum" AS ENUM ('customer', 'contractor', 'admin');
      CREATE TYPE "public"."tasks_status_enum" AS ENUM (
        'draft',
        'published',
        'in_progress',
        'completed_by_contractor',
        'done',
        'cancelled'
      );
      CREATE TYPE "public"."bids_status_enum" AS ENUM ('pending', 'selected', 'rejected', 'cancelled');

      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "role" "public"."users_role_enum" NOT NULL,
        "balance" integer NOT NULL DEFAULT 0,
        "is_blocked" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      );

      CREATE TABLE "tasks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" character varying(255) NOT NULL,
        "description" text NOT NULL,
        "price" integer NOT NULL,
        "status" "public"."tasks_status_enum" NOT NULL DEFAULT 'draft',
        "customer_id" uuid NOT NULL,
        "selected_bid_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tasks_id" PRIMARY KEY ("id")
      );

      CREATE TABLE "bids" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL,
        "contractor_id" uuid NOT NULL,
        "comment" text,
        "status" "public"."bids_status_enum" NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bids_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bids_task_contractor" UNIQUE ("task_id", "contractor_id")
      );

      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL,
        "from_user_id" uuid NOT NULL,
        "to_user_id" uuid NOT NULL,
        "amount" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id")
      );

      CREATE UNIQUE INDEX "IDX_tasks_selected_bid_id" ON "tasks" ("selected_bid_id");
      CREATE INDEX "IDX_tasks_customer_id" ON "tasks" ("customer_id");
      CREATE INDEX "IDX_tasks_status" ON "tasks" ("status");
      CREATE INDEX "IDX_bids_task_id" ON "bids" ("task_id");
      CREATE INDEX "IDX_bids_contractor_id" ON "bids" ("contractor_id");
      CREATE INDEX "IDX_bids_status" ON "bids" ("status");
      CREATE INDEX "IDX_payments_task_id" ON "payments" ("task_id");
      CREATE INDEX "IDX_payments_from_user_id" ON "payments" ("from_user_id");
      CREATE INDEX "IDX_payments_to_user_id" ON "payments" ("to_user_id");

      ALTER TABLE "tasks"
        ADD CONSTRAINT "FK_tasks_customer_id" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE;
      ALTER TABLE "bids"
        ADD CONSTRAINT "FK_bids_task_id" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE;
      ALTER TABLE "bids"
        ADD CONSTRAINT "FK_bids_contractor_id" FOREIGN KEY ("contractor_id") REFERENCES "users"("id") ON DELETE CASCADE;
      ALTER TABLE "payments"
        ADD CONSTRAINT "FK_payments_task_id" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE;
      ALTER TABLE "payments"
        ADD CONSTRAINT "FK_payments_from_user_id" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
      ALTER TABLE "payments"
        ADD CONSTRAINT "FK_payments_to_user_id" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
      ALTER TABLE "tasks"
        ADD CONSTRAINT "FK_tasks_selected_bid_id" FOREIGN KEY ("selected_bid_id") REFERENCES "bids"("id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_selected_bid_id";
      ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_to_user_id";
      ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_from_user_id";
      ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_task_id";
      ALTER TABLE "bids" DROP CONSTRAINT "FK_bids_contractor_id";
      ALTER TABLE "bids" DROP CONSTRAINT "FK_bids_task_id";
      ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_customer_id";

      DROP INDEX "public"."IDX_payments_to_user_id";
      DROP INDEX "public"."IDX_payments_from_user_id";
      DROP INDEX "public"."IDX_payments_task_id";
      DROP INDEX "public"."IDX_bids_status";
      DROP INDEX "public"."IDX_bids_contractor_id";
      DROP INDEX "public"."IDX_bids_task_id";
      DROP INDEX "public"."IDX_tasks_status";
      DROP INDEX "public"."IDX_tasks_customer_id";
      DROP INDEX "public"."IDX_tasks_selected_bid_id";

      DROP TABLE "payments";
      DROP TABLE "bids";
      DROP TABLE "tasks";
      DROP TABLE "users";

      DROP TYPE "public"."bids_status_enum";
      DROP TYPE "public"."tasks_status_enum";
      DROP TYPE "public"."users_role_enum";
    `);
  }
}
