-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "notification_delivery_status" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "carrier_connection_status" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "carrier_event_status" AS ENUM ('IN_TRANSIT', 'DELIVERED', 'EXCEPTION', 'UNKNOWN');

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_employee_id" UUID NOT NULL,
    "updated_by_employee_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "channel" "notification_channel" NOT NULL DEFAULT 'EMAIL',
    "subject_template" VARCHAR(240) NOT NULL,
    "body_template" TEXT NOT NULL,
    "allowed_variables" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "outbox_event_id" UUID NOT NULL,
    "channel" "notification_channel" NOT NULL DEFAULT 'EMAIL',
    "recipient_email" VARCHAR(320) NOT NULL,
    "subject" VARCHAR(240) NOT NULL,
    "body" TEXT NOT NULL,
    "status" "notification_delivery_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_by" VARCHAR(120),
    "locked_until" TIMESTAMPTZ(3),
    "provider_message_id" VARCHAR(200),
    "last_error_code" VARCHAR(120),
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_employee_id" UUID NOT NULL,
    "updated_by_employee_id" UUID NOT NULL,
    "carrier_code" VARCHAR(20) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "connection_key" VARCHAR(80) NOT NULL,
    "secret_reference" VARCHAR(120) NOT NULL,
    "status" "carrier_connection_status" NOT NULL DEFAULT 'DISABLED',
    "last_tested_at" TIMESTAMPTZ(3),
    "last_error_code" VARCHAR(120),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carrier_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_webhook_receipts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "provider_event_id" VARCHAR(160) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "signature_hash" CHAR(64) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "carrier_webhook_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_tracking_snapshots" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "webhook_receipt_id" UUID,
    "external_event_id" VARCHAR(160) NOT NULL,
    "status" "carrier_event_status" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "location" VARCHAR(160),
    "description" VARCHAR(300),
    "payload_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carrier_tracking_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_templates_org_event_active_idx" ON "notification_templates"("organization_id", "event_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_organization_id_id_key" ON "notification_templates"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_org_code_key" ON "notification_templates"("organization_id", "code");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_available_created_idx" ON "notification_deliveries"("status", "available_at", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_org_status_created_idx" ON "notification_deliveries"("organization_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_organization_id_id_key" ON "notification_deliveries"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_org_outbox_template_key" ON "notification_deliveries"("organization_id", "outbox_event_id", "template_id");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_connections_connection_key_key" ON "carrier_connections"("connection_key");

-- CreateIndex
CREATE INDEX "carrier_connections_org_status_idx" ON "carrier_connections"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_connections_organization_id_id_key" ON "carrier_connections"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_connections_org_carrier_code_key" ON "carrier_connections"("organization_id", "carrier_code");

-- CreateIndex
CREATE INDEX "carrier_webhook_receipts_org_received_idx" ON "carrier_webhook_receipts"("organization_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_webhook_receipts_organization_id_id_key" ON "carrier_webhook_receipts"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_webhook_receipts_connection_event_key" ON "carrier_webhook_receipts"("connection_id", "provider_event_id");

-- CreateIndex
CREATE INDEX "carrier_tracking_snapshots_org_package_occurred_idx" ON "carrier_tracking_snapshots"("organization_id", "package_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_tracking_snapshots_organization_id_id_key" ON "carrier_tracking_snapshots"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_tracking_snapshots_connection_event_key" ON "carrier_tracking_snapshots"("connection_id", "external_event_id");

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_created_by_employee_id_fkey" FOREIGN KEY ("organization_id", "created_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_updated_by_employee_id_fkey" FOREIGN KEY ("organization_id", "updated_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_org_template_id_fkey" FOREIGN KEY ("organization_id", "template_id") REFERENCES "notification_templates"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_connections" ADD CONSTRAINT "carrier_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_connections" ADD CONSTRAINT "carrier_connections_created_by_employee_id_fkey" FOREIGN KEY ("organization_id", "created_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_connections" ADD CONSTRAINT "carrier_connections_updated_by_employee_id_fkey" FOREIGN KEY ("organization_id", "updated_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_webhook_receipts" ADD CONSTRAINT "carrier_webhook_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_webhook_receipts" ADD CONSTRAINT "carrier_webhook_receipts_org_connection_id_fkey" FOREIGN KEY ("organization_id", "connection_id") REFERENCES "carrier_connections"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_tracking_snapshots" ADD CONSTRAINT "carrier_tracking_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_tracking_snapshots" ADD CONSTRAINT "carrier_tracking_snapshots_org_connection_id_fkey" FOREIGN KEY ("organization_id", "connection_id") REFERENCES "carrier_connections"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_tracking_snapshots" ADD CONSTRAINT "carrier_tracking_snapshots_org_package_id_fkey" FOREIGN KEY ("organization_id", "package_id") REFERENCES "packages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_tracking_snapshots" ADD CONSTRAINT "carrier_tracking_snapshots_org_receipt_id_fkey" FOREIGN KEY ("organization_id", "webhook_receipt_id") REFERENCES "carrier_webhook_receipts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
