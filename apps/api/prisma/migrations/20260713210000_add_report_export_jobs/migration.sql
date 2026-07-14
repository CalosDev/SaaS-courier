CREATE TYPE "report_export_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');
CREATE TYPE "report_type" AS ENUM ('OPERATIONS', 'INVENTORY', 'BILLING', 'SHIPMENTS', 'CUSTOMS');

CREATE TABLE "report_export_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "requested_by_employee_id" UUID NOT NULL,
    "report_type" "report_type" NOT NULL,
    "status" "report_export_status" NOT NULL DEFAULT 'PENDING',
    "filters" JSONB NOT NULL,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "file_name" VARCHAR(180),
    "content_type" VARCHAR(80),
    "content" TEXT,
    "row_count" INTEGER,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "error_code" VARCHAR(120),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "report_export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_export_jobs_organization_id_id_key" ON "report_export_jobs"("organization_id", "id");
CREATE UNIQUE INDEX "report_export_jobs_org_idempotency_key_key" ON "report_export_jobs"("organization_id", "idempotency_key");
CREATE INDEX "report_export_jobs_org_status_created_at_idx" ON "report_export_jobs"("organization_id", "status", "created_at");
CREATE INDEX "report_export_jobs_status_created_at_idx" ON "report_export_jobs"("status", "created_at");
CREATE INDEX "report_export_jobs_expires_at_idx" ON "report_export_jobs"("expires_at");

ALTER TABLE "report_export_jobs"
ADD CONSTRAINT "report_export_jobs_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "report_export_jobs"
ADD CONSTRAINT "report_export_jobs_requested_by_employee_id_fkey"
FOREIGN KEY ("organization_id", "requested_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
