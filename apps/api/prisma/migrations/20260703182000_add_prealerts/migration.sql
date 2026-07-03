CREATE TYPE "prealert_status" AS ENUM ('PENDING_ARRIVAL', 'CANCELLED');
CREATE TYPE "prealert_invoice_status" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PROVIDED', 'REJECTED', 'VERIFIED');

CREATE TABLE "prealerts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "created_by_employee_id" UUID NOT NULL,
    "prealert_code" VARCHAR(20) NOT NULL,
    "external_tracking_number" VARCHAR(100) NOT NULL,
    "external_tracking_number_normalized" VARCHAR(100) NOT NULL,
    "carrier_name" VARCHAR(100),
    "store_name" VARCHAR(160) NOT NULL,
    "purchase_date" DATE,
    "description" VARCHAR(500) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "declared_value" DECIMAL(14,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "invoice_status" "prealert_invoice_status" NOT NULL DEFAULT 'PENDING',
    "status" "prealert_status" NOT NULL DEFAULT 'PENDING_ARRIVAL',
    "notes" VARCHAR(1000),
    "cancellation_reason" VARCHAR(500),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by_employee_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "prealerts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "prealerts_prealert_code_non_empty" CHECK (length(btrim("prealert_code")) > 0),
    CONSTRAINT "prealerts_prealert_code_trimmed" CHECK ("prealert_code" = btrim("prealert_code")),
    CONSTRAINT "prealerts_prealert_code_format" CHECK ("prealert_code" ~ '^PA[A-HJ-NP-Z2-9]{10}$'),
    CONSTRAINT "prealerts_tracking_non_empty" CHECK (length(btrim("external_tracking_number")) > 0),
    CONSTRAINT "prealerts_tracking_trimmed" CHECK ("external_tracking_number" = btrim("external_tracking_number")),
    CONSTRAINT "prealerts_tracking_normalized_format" CHECK ("external_tracking_number_normalized" ~ '^[A-Z0-9]{3,100}$'),
    CONSTRAINT "prealerts_store_name_length" CHECK (length(btrim("store_name")) BETWEEN 2 AND 160),
    CONSTRAINT "prealerts_description_length" CHECK (length(btrim("description")) BETWEEN 3 AND 500),
    CONSTRAINT "prealerts_quantity_range" CHECK ("quantity" BETWEEN 1 AND 999),
    CONSTRAINT "prealerts_declared_value_range" CHECK ("declared_value" > 0 AND "declared_value" <= 9999999999.99),
    CONSTRAINT "prealerts_currency_code_format" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
    CONSTRAINT "prealerts_cancelled_consistency" CHECK (
      ("status" = 'PENDING_ARRIVAL' AND "cancelled_at" IS NULL AND "cancelled_by_employee_id" IS NULL AND "cancellation_reason" IS NULL)
      OR
      ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL AND "cancelled_by_employee_id" IS NOT NULL AND length(btrim("cancellation_reason")) BETWEEN 3 AND 500)
    )
);

CREATE INDEX "prealerts_organization_id_customer_id_idx" ON "prealerts"("organization_id", "customer_id");
CREATE INDEX "prealerts_organization_id_status_created_at_idx" ON "prealerts"("organization_id", "status", "created_at");
CREATE INDEX "prealerts_organization_id_invoice_status_created_at_idx" ON "prealerts"("organization_id", "invoice_status", "created_at");
CREATE INDEX "prealerts_organization_id_created_by_employee_id_idx" ON "prealerts"("organization_id", "created_by_employee_id");
CREATE INDEX "prealerts_organization_id_cancelled_by_employee_id_idx" ON "prealerts"("organization_id", "cancelled_by_employee_id");
CREATE INDEX "prealerts_organization_id_tracking_normalized_idx" ON "prealerts"("organization_id", "external_tracking_number_normalized");
CREATE INDEX "prealerts_organization_id_deleted_at_idx" ON "prealerts"("organization_id", "deleted_at");
CREATE UNIQUE INDEX "prealerts_organization_id_prealert_code_key" ON "prealerts"("organization_id", "prealert_code");
CREATE UNIQUE INDEX "prealerts_organization_id_id_key" ON "prealerts"("organization_id", "id");
CREATE UNIQUE INDEX "prealerts_one_pending_tracking_per_organization"
  ON "prealerts"("organization_id", "external_tracking_number_normalized")
  WHERE "status" = 'PENDING_ARRIVAL'
    AND "deleted_at" IS NULL;

ALTER TABLE "prealerts" ADD CONSTRAINT "prealerts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prealerts" ADD CONSTRAINT "prealerts_organization_id_customer_id_fkey"
  FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prealerts" ADD CONSTRAINT "prealerts_organization_id_created_by_employee_id_fkey"
  FOREIGN KEY ("organization_id", "created_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prealerts" ADD CONSTRAINT "prealerts_organization_id_cancelled_by_employee_id_fkey"
  FOREIGN KEY ("organization_id", "cancelled_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
