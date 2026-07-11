-- CreateEnum
CREATE TYPE "package_status" AS ENUM ('RECEPTION_PENDING', 'CANCELLED');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'prealert_status'
  ) THEN
    CREATE TYPE "prealert_status" AS ENUM ('PENDING_ARRIVAL', 'CANCELLED');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    INNER JOIN pg_enum e
      ON e.enumtypid = t.oid
    WHERE t.typname = 'prealert_status'
      AND e.enumlabel = 'MATCHED'
  ) THEN
    ALTER TYPE "prealert_status" ADD VALUE 'MATCHED';
  END IF;
END
$$;

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "prealert_id" UUID,
    "registered_by_employee_id" UUID NOT NULL,
    "internal_tracking_number" VARCHAR(24) NOT NULL,
    "external_tracking_number" VARCHAR(100) NOT NULL,
    "external_tracking_number_normalized" VARCHAR(100) NOT NULL,
    "status" "package_status" NOT NULL DEFAULT 'RECEPTION_PENDING',
    "notes" VARCHAR(1000),
    "cancellation_reason" VARCHAR(500),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by_employee_id" UUID,
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "packages_internal_tracking_non_empty" CHECK (length(btrim("internal_tracking_number")) > 0),
    CONSTRAINT "packages_internal_tracking_trimmed" CHECK ("internal_tracking_number" = btrim("internal_tracking_number")),
    CONSTRAINT "packages_internal_tracking_format" CHECK ("internal_tracking_number" ~ '^PK[A-HJ-NP-Z2-9]{12}$'),
    CONSTRAINT "packages_tracking_non_empty" CHECK (length(btrim("external_tracking_number")) > 0),
    CONSTRAINT "packages_tracking_trimmed" CHECK ("external_tracking_number" = btrim("external_tracking_number")),
    CONSTRAINT "packages_tracking_normalized_format" CHECK ("external_tracking_number_normalized" ~ '^[A-Z0-9]{3,100}$'),
    CONSTRAINT "packages_cancelled_consistency" CHECK (
      ("status" = 'RECEPTION_PENDING' AND "cancelled_at" IS NULL AND "cancelled_by_employee_id" IS NULL AND "cancellation_reason" IS NULL)
      OR
      ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL AND "cancelled_by_employee_id" IS NOT NULL AND length(btrim("cancellation_reason")) BETWEEN 3 AND 500)
    )
);

-- CreateIndex
CREATE INDEX "packages_organization_id_customer_id_idx" ON "packages"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "packages_organization_id_prealert_id_idx" ON "packages"("organization_id", "prealert_id");

-- CreateIndex
CREATE INDEX "packages_organization_id_status_registered_at_idx" ON "packages"("organization_id", "status", "registered_at");

-- CreateIndex
CREATE INDEX "packages_organization_id_registered_by_employee_id_idx" ON "packages"("organization_id", "registered_by_employee_id");

-- CreateIndex
CREATE INDEX "packages_organization_id_cancelled_by_employee_id_idx" ON "packages"("organization_id", "cancelled_by_employee_id");

-- CreateIndex
CREATE INDEX "packages_organization_id_tracking_normalized_idx" ON "packages"("organization_id", "external_tracking_number_normalized");

-- CreateIndex
CREATE INDEX "packages_organization_id_deleted_at_idx" ON "packages"("organization_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "packages_organization_id_internal_tracking_number_key" ON "packages"("organization_id", "internal_tracking_number");

-- CreateIndex
CREATE UNIQUE INDEX "packages_organization_id_id_key" ON "packages"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "packages_one_active_external_tracking_per_organization"
  ON "packages"("organization_id", "external_tracking_number_normalized")
  WHERE "status" = 'RECEPTION_PENDING'
    AND "deleted_at" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "packages_one_active_prealert_per_organization"
  ON "packages"("organization_id", "prealert_id")
  WHERE "prealert_id" IS NOT NULL
    AND "status" = 'RECEPTION_PENDING'
    AND "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_organization_id_customer_id_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_organization_id_registered_by_employee_id_fkey" FOREIGN KEY ("organization_id", "registered_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_organization_id_cancelled_by_employee_id_fkey" FOREIGN KEY ("organization_id", "cancelled_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
