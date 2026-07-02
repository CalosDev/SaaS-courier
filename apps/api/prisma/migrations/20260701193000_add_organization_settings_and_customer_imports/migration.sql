-- CreateEnum
CREATE TYPE "customer_code_strategy" AS ENUM ('AUTO_RANDOM', 'AUTO_SEQUENTIAL');

-- CreateEnum
CREATE TYPE "weight_unit" AS ENUM ('LB', 'KG');

-- CreateEnum
CREATE TYPE "dimension_unit" AS ENUM ('IN', 'CM');

-- CreateEnum
CREATE TYPE "date_display_format" AS ENUM ('DMY', 'MDY', 'YMD');

-- CreateEnum
CREATE TYPE "customer_import_job_status" AS ENUM ('DRAFT', 'VALIDATED', 'IMPORTING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "customer_import_row_status" AS ENUM ('PENDING', 'VALID', 'INVALID', 'IMPORTED');

-- CreateTable
CREATE TABLE "organization_settings" (
    "organization_id" UUID NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'es-DO',
    "date_format" "date_display_format" NOT NULL DEFAULT 'DMY',
    "weight_unit" "weight_unit" NOT NULL DEFAULT 'LB',
    "dimension_unit" "dimension_unit" NOT NULL DEFAULT 'IN',
    "customer_code_strategy" "customer_code_strategy" NOT NULL DEFAULT 'AUTO_RANDOM',
    "customer_code_prefix" VARCHAR(8) NOT NULL DEFAULT 'C',
    "customer_code_random_length" INTEGER NOT NULL DEFAULT 8,
    "customer_code_sequence_padding" INTEGER NOT NULL DEFAULT 6,
    "next_customer_sequence" BIGINT NOT NULL DEFAULT 1,
    "onboarding_completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("organization_id"),
    CONSTRAINT "organization_settings_locale_chk" CHECK ("locale" ~ '^[a-z]{2}-[A-Z]{2}$'),
    CONSTRAINT "organization_settings_prefix_chk" CHECK ("customer_code_prefix" ~ '^[A-Z0-9][A-Z0-9_-]{0,7}$'),
    CONSTRAINT "organization_settings_random_length_chk" CHECK ("customer_code_random_length" BETWEEN 4 AND 16),
    CONSTRAINT "organization_settings_padding_chk" CHECK ("customer_code_sequence_padding" BETWEEN 3 AND 12),
    CONSTRAINT "organization_settings_next_sequence_chk" CHECK ("next_customer_sequence" > 0),
    CONSTRAINT "organization_settings_random_code_len_chk" CHECK (char_length("customer_code_prefix") + "customer_code_random_length" <= 40),
    CONSTRAINT "organization_settings_seq_code_len_chk" CHECK (char_length("customer_code_prefix") + "customer_code_sequence_padding" <= 40)
);

-- CreateTable
CREATE TABLE "customer_import_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_employee_id" UUID NOT NULL,
    "name" VARCHAR(160),
    "status" "customer_import_job_status" NOT NULL,
    "preserve_customer_codes" BOOLEAN NOT NULL DEFAULT false,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "validation_summary" JSONB,
    "failure_code" VARCHAR(80),
    "validated_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_import_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_import_jobs_total_rows_chk" CHECK ("total_rows" BETWEEN 0 AND 250),
    CONSTRAINT "customer_import_jobs_valid_rows_chk" CHECK ("valid_rows" >= 0),
    CONSTRAINT "customer_import_jobs_invalid_rows_chk" CHECK ("invalid_rows" >= 0),
    CONSTRAINT "customer_import_jobs_imported_rows_chk" CHECK ("imported_rows" >= 0),
    CONSTRAINT "customer_import_jobs_valid_invalid_sum_chk" CHECK ("valid_rows" + "invalid_rows" <= "total_rows"),
    CONSTRAINT "customer_import_jobs_imported_valid_chk" CHECK ("imported_rows" <= "valid_rows"),
    CONSTRAINT "customer_import_jobs_completed_state_chk" CHECK (
      "status" <> 'COMPLETED'
      OR ("completed_at" IS NOT NULL AND "imported_rows" = "total_rows")
    ),
    CONSTRAINT "customer_import_jobs_cancelled_state_chk" CHECK (
      "status" <> 'CANCELLED'
      OR "cancelled_at" IS NOT NULL
    ),
    CONSTRAINT "customer_import_jobs_terminal_timestamps_chk" CHECK (
      (CASE WHEN "completed_at" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "cancelled_at" IS NOT NULL THEN 1 ELSE 0 END) <= 1
    )
);

-- CreateTable
CREATE TABLE "customer_import_rows" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "import_job_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_data" JSONB NOT NULL,
    "normalized_data" JSONB,
    "status" "customer_import_row_status" NOT NULL DEFAULT 'PENDING',
    "validation_errors" JSONB,
    "imported_customer_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_import_rows_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_import_rows_row_number_chk" CHECK ("row_number" > 0),
    CONSTRAINT "customer_import_rows_imported_state_chk" CHECK (
      "status" <> 'IMPORTED'
      OR "imported_customer_id" IS NOT NULL
    ),
    CONSTRAINT "customer_import_rows_invalid_state_chk" CHECK (
      "status" <> 'INVALID'
      OR "validation_errors" IS NOT NULL
    ),
    CONSTRAINT "customer_import_rows_valid_state_chk" CHECK (
      "status" <> 'VALID'
      OR "validation_errors" IS NULL
    )
);

-- CreateIndex
CREATE INDEX "customer_import_jobs_organization_id_status_idx" ON "customer_import_jobs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "customer_import_jobs_organization_id_created_by_employee_id_idx" ON "customer_import_jobs"("organization_id", "created_by_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_import_jobs_organization_id_id_key" ON "customer_import_jobs"("organization_id", "id");

-- CreateIndex
CREATE INDEX "customer_import_rows_organization_id_import_job_id_idx" ON "customer_import_rows"("organization_id", "import_job_id");

-- CreateIndex
CREATE INDEX "customer_import_rows_organization_id_status_idx" ON "customer_import_rows"("organization_id", "status");

-- CreateIndex
CREATE INDEX "customer_import_rows_organization_id_imported_customer_id_idx" ON "customer_import_rows"("organization_id", "imported_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_import_rows_org_job_row_key" ON "customer_import_rows"("organization_id", "import_job_id", "row_number");

-- AddForeignKey
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_import_jobs" ADD CONSTRAINT "customer_import_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_import_jobs" ADD CONSTRAINT "customer_import_jobs_created_by_employee_fkey" FOREIGN KEY ("organization_id", "created_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_import_rows" ADD CONSTRAINT "customer_import_rows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_import_rows" ADD CONSTRAINT "customer_import_rows_organization_id_import_job_id_fkey" FOREIGN KEY ("organization_id", "import_job_id") REFERENCES "customer_import_jobs"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_import_rows" ADD CONSTRAINT "customer_import_rows_organization_id_imported_customer_id_fkey" FOREIGN KEY ("organization_id", "imported_customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill
INSERT INTO "organization_settings" ("organization_id")
SELECT "id"
FROM "organizations"
WHERE NOT EXISTS (
  SELECT 1
  FROM "organization_settings" s
  WHERE s."organization_id" = "organizations"."id"
);
