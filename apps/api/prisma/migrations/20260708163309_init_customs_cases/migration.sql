-- CreateEnum
CREATE TYPE "customs_case_status" AS ENUM ('PENDING_REVIEW', 'UNDER_REVIEW', 'RELEASED', 'HELD', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "customs_event_source" AS ENUM ('MANUAL', 'OFFICIAL_PORTAL', 'AUTHORIZED_INTEGRATION');

-- CreateTable
CREATE TABLE "customs_cases" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "case_number" VARCHAR(120) NOT NULL,
    "status" "customs_case_status" NOT NULL DEFAULT 'PENDING_REVIEW',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customs_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_case_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customs_case_id" UUID NOT NULL,
    "source" "customs_event_source" NOT NULL,
    "event_date" TIMESTAMPTZ(3) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customs_case_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customs_cases_org_case_number_key" ON "customs_cases"("organization_id", "case_number");

-- CreateIndex
CREATE UNIQUE INDEX "customs_cases_organization_id_id_key" ON "customs_cases"("organization_id", "id");

-- CreateIndex
CREATE INDEX "customs_case_events_org_customs_case_idx" ON "customs_case_events"("organization_id", "customs_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "customs_case_events_organization_id_id_key" ON "customs_case_events"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "customs_cases" ADD CONSTRAINT "customs_cases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_case_events" ADD CONSTRAINT "customs_case_events_org_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_case_events" ADD CONSTRAINT "customs_case_events_org_customs_case_fkey" FOREIGN KEY ("organization_id", "customs_case_id") REFERENCES "customs_cases"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
