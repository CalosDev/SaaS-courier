-- CreateEnum
CREATE TYPE "pickup_request_status" AS ENUM ('DRAFT', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "pickup_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "pickup_number" VARCHAR(40) NOT NULL,
    "status" "pickup_request_status" NOT NULL DEFAULT 'DRAFT',
    "requested_by_employee_id" UUID NOT NULL,
    "completed_by_employee_id" UUID,
    "cancelled_by_employee_id" UUID,
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_request_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "pickup_request_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pickup_requests_org_customer_id_idx" ON "pickup_requests"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "pickup_requests_org_facility_status_idx" ON "pickup_requests"("organization_id", "facility_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_requests_org_pickup_number_key" ON "pickup_requests"("organization_id", "pickup_number");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_requests_organization_id_id_key" ON "pickup_requests"("organization_id", "id");

-- CreateIndex
CREATE INDEX "pickup_request_items_org_pickup_request_idx" ON "pickup_request_items"("organization_id", "pickup_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_request_items_organization_id_id_key" ON "pickup_request_items"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_request_items_org_pkg_pickup_key" ON "pickup_request_items"("organization_id", "package_id", "pickup_request_id");

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_org_facility_id_fkey" FOREIGN KEY ("organization_id", "facility_id") REFERENCES "facilities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_org_customer_id_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_requested_by_fkey" FOREIGN KEY ("organization_id", "requested_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_completed_by_fkey" FOREIGN KEY ("organization_id", "completed_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_cancelled_by_fkey" FOREIGN KEY ("organization_id", "cancelled_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_request_items" ADD CONSTRAINT "pickup_request_items_org_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_request_items" ADD CONSTRAINT "pickup_request_items_org_pickup_request_fkey" FOREIGN KEY ("organization_id", "pickup_request_id") REFERENCES "pickup_requests"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_request_items" ADD CONSTRAINT "pickup_request_items_org_package_fkey" FOREIGN KEY ("organization_id", "package_id") REFERENCES "packages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
