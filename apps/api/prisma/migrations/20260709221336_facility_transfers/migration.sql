-- CreateEnum
CREATE TYPE "facility_transfer_status" AS ENUM ('DRAFT', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "facility_transfer_item_status" AS ENUM ('PENDING', 'RECEIVED', 'MISSING', 'DAMAGED');

-- CreateEnum
CREATE TYPE "facility_transfer_event_type" AS ENUM ('CREATED', 'DISPATCHED', 'RECEIVED', 'CANCELLED', 'ITEM_MARKED_MISSING', 'ITEM_MARKED_DAMAGED');

-- CreateTable
CREATE TABLE "facility_transfers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "transfer_number" VARCHAR(40) NOT NULL,
    "origin_facility_id" UUID NOT NULL,
    "destination_facility_id" UUID NOT NULL,
    "status" "facility_transfer_status" NOT NULL DEFAULT 'DRAFT',
    "notes" VARCHAR(1000),
    "vehicle_info" VARCHAR(200),
    "dispatched_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "dispatched_by_id" UUID,
    "received_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_transfer_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "status" "facility_transfer_item_status" NOT NULL DEFAULT 'PENDING',
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_transfer_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "event_type" "facility_transfer_event_type" NOT NULL,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_transfer_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facility_transfers_org_origin_status_idx" ON "facility_transfers"("organization_id", "origin_facility_id", "status");

-- CreateIndex
CREATE INDEX "facility_transfers_org_destination_status_idx" ON "facility_transfers"("organization_id", "destination_facility_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "facility_transfers_org_transfer_number_key" ON "facility_transfers"("organization_id", "transfer_number");

-- CreateIndex
CREATE UNIQUE INDEX "facility_transfers_org_id_key" ON "facility_transfers"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "facility_transfer_items_org_transfer_package_key" ON "facility_transfer_items"("organization_id", "transfer_id", "package_id");

-- CreateIndex
CREATE UNIQUE INDEX "facility_transfer_items_org_id_key" ON "facility_transfer_items"("organization_id", "id");

-- CreateIndex
CREATE INDEX "facility_transfer_events_org_transfer_created_idx" ON "facility_transfer_events"("organization_id", "transfer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "facility_transfer_events_org_id_key" ON "facility_transfer_events"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "facility_transfers" ADD CONSTRAINT "facility_transfers_org_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_transfers" ADD CONSTRAINT "facility_transfers_org_origin_facility_fkey" FOREIGN KEY ("organization_id", "origin_facility_id") REFERENCES "facilities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_transfers" ADD CONSTRAINT "facility_transfers_org_destination_facility_fkey" FOREIGN KEY ("organization_id", "destination_facility_id") REFERENCES "facilities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_transfers" ADD CONSTRAINT "facility_transfers_created_by_fkey" FOREIGN KEY ("organization_id", "created_by_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_transfers" ADD CONSTRAINT "facility_transfers_dispatched_by_fkey" FOREIGN KEY ("organization_id", "dispatched_by_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_transfers" ADD CONSTRAINT "facility_transfers_received_by_fkey" FOREIGN KEY ("organization_id", "received_by_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_transfer_items" ADD CONSTRAINT "facility_transfer_items_org_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_transfer_items" ADD CONSTRAINT "facility_transfer_items_org_transfer_id_fkey" FOREIGN KEY ("organization_id", "transfer_id") REFERENCES "facility_transfers"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_transfer_items" ADD CONSTRAINT "facility_transfer_items_org_package_id_fkey" FOREIGN KEY ("organization_id", "package_id") REFERENCES "packages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_transfer_events" ADD CONSTRAINT "facility_transfer_events_org_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_transfer_events" ADD CONSTRAINT "facility_transfer_events_org_transfer_id_fkey" FOREIGN KEY ("organization_id", "transfer_id") REFERENCES "facility_transfers"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
