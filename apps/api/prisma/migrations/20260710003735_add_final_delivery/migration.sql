-- CreateEnum
CREATE TYPE "delivery_method" AS ENUM ('HOME_DELIVERY', 'THIRD_PARTY', 'COUNTER_HANDOFF');

-- CreateEnum
CREATE TYPE "delivery_status" AS ENUM ('DRAFT', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "delivery_attempt_result" AS ENUM ('DELIVERED', 'NOT_HOME', 'REJECTED', 'ADDRESS_ISSUE', 'OTHER');

-- CreateTable
CREATE TABLE "delivery_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "delivery_number" VARCHAR(40) NOT NULL,
    "customer_id" UUID NOT NULL,
    "method" "delivery_method" NOT NULL,
    "status" "delivery_status" NOT NULL DEFAULT 'DRAFT',
    "delivery_address_snap" JSONB,
    "notes" VARCHAR(1000),
    "created_by_id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "dispatched_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_order_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_attempts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "attempted_at" TIMESTAMPTZ(3) NOT NULL,
    "result" "delivery_attempt_result" NOT NULL,
    "notes" VARCHAR(1000),
    "receiver_name" VARCHAR(120),
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_orders_org_status_idx" ON "delivery_orders"("organization_id", "status");

-- CreateIndex
CREATE INDEX "delivery_orders_org_customer_idx" ON "delivery_orders"("organization_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_orders_org_id_key" ON "delivery_orders"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_orders_org_delivery_number_key" ON "delivery_orders"("organization_id", "delivery_number");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_order_items_org_id_key" ON "delivery_order_items"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_order_items_org_delivery_package_key" ON "delivery_order_items"("organization_id", "delivery_id", "package_id");

-- CreateIndex
CREATE INDEX "delivery_attempts_org_delivery_idx" ON "delivery_attempts"("organization_id", "delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_attempts_org_id_key" ON "delivery_attempts"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_org_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_org_customer_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_created_by_fkey" FOREIGN KEY ("organization_id", "created_by_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_assigned_to_fkey" FOREIGN KEY ("organization_id", "assigned_to_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_order_items" ADD CONSTRAINT "delivery_order_items_org_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_order_items" ADD CONSTRAINT "delivery_order_items_org_delivery_fkey" FOREIGN KEY ("organization_id", "delivery_id") REFERENCES "delivery_orders"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_order_items" ADD CONSTRAINT "delivery_order_items_org_package_fkey" FOREIGN KEY ("organization_id", "package_id") REFERENCES "packages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_org_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_org_delivery_fkey" FOREIGN KEY ("organization_id", "delivery_id") REFERENCES "delivery_orders"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_recorded_by_fkey" FOREIGN KEY ("organization_id", "recorded_by_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
