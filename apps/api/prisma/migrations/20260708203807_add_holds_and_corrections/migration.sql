-- CreateEnum
CREATE TYPE "hold_status" AS ENUM ('ACTIVE', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "correction_status" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "correction_target_type" AS ENUM ('PACKAGE', 'PREALERT', 'MANIFEST', 'CUSTOMS_CASE', 'INVOICE');

-- CreateTable
CREATE TABLE "operational_holds" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" UUID NOT NULL,
    "status" "hold_status" NOT NULL DEFAULT 'ACTIVE',
    "reason" VARCHAR(1000) NOT NULL,
    "requested_by_employee_id" UUID NOT NULL,
    "released_by_employee_id" UUID,
    "release_reason" VARCHAR(1000),
    "released_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "target_type" "correction_target_type" NOT NULL,
    "target_id" UUID NOT NULL,
    "status" "correction_status" NOT NULL DEFAULT 'REQUESTED',
    "reason" VARCHAR(1000) NOT NULL,
    "proposed_data" JSONB NOT NULL,
    "requested_by_employee_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_decisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "correction_request_id" UUID NOT NULL,
    "decision" "correction_status" NOT NULL,
    "reason" VARCHAR(1000),
    "decided_by_employee_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correction_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operational_holds_org_target_idx" ON "operational_holds"("organization_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "operational_holds_org_status_idx" ON "operational_holds"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "operational_holds_organization_id_id_key" ON "operational_holds"("organization_id", "id");

-- CreateIndex
CREATE INDEX "correction_requests_org_target_idx" ON "correction_requests"("organization_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "correction_requests_org_status_idx" ON "correction_requests"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "correction_requests_organization_id_id_key" ON "correction_requests"("organization_id", "id");

-- CreateIndex
CREATE INDEX "correction_decisions_org_req_idx" ON "correction_decisions"("organization_id", "correction_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "correction_decisions_organization_id_id_key" ON "correction_decisions"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "operational_holds" ADD CONSTRAINT "operational_holds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_holds" ADD CONSTRAINT "operational_holds_requested_by_fkey" FOREIGN KEY ("organization_id", "requested_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_holds" ADD CONSTRAINT "operational_holds_released_by_fkey" FOREIGN KEY ("organization_id", "released_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_requested_by_fkey" FOREIGN KEY ("organization_id", "requested_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_decisions" ADD CONSTRAINT "correction_decisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_decisions" ADD CONSTRAINT "correction_decisions_org_req_fkey" FOREIGN KEY ("organization_id", "correction_request_id") REFERENCES "correction_requests"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_decisions" ADD CONSTRAINT "correction_decisions_decided_by_fkey" FOREIGN KEY ("organization_id", "decided_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
