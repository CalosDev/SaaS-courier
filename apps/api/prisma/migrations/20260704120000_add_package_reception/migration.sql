ALTER TYPE "package_status" ADD VALUE 'RECEIVED_AT_ORIGIN';

CREATE TYPE "package_condition" AS ENUM (
  'SEALED',
  'OPEN',
  'DAMAGED',
  'WET',
  'CRUSHED',
  'OTHER'
);

CREATE TABLE "package_receptions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "package_id" UUID NOT NULL,
  "facility_id" UUID NOT NULL,
  "received_by_employee_id" UUID NOT NULL,
  "weight" DECIMAL(12,3) NOT NULL,
  "weight_unit" "weight_unit" NOT NULL,
  "length" DECIMAL(12,2) NOT NULL,
  "width" DECIMAL(12,2) NOT NULL,
  "height" DECIMAL(12,2) NOT NULL,
  "dimension_unit" "dimension_unit" NOT NULL,
  "piece_count" INTEGER NOT NULL,
  "condition" "package_condition" NOT NULL,
  "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "package_receptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "package_receptions_weight_check" CHECK ("weight" > 0 AND "weight" <= 100000),
  CONSTRAINT "package_receptions_length_check" CHECK ("length" > 0 AND "length" <= 10000),
  CONSTRAINT "package_receptions_width_check" CHECK ("width" > 0 AND "width" <= 10000),
  CONSTRAINT "package_receptions_height_check" CHECK ("height" > 0 AND "height" <= 10000),
  CONSTRAINT "package_receptions_piece_count_check" CHECK ("piece_count" > 0 AND "piece_count" <= 10000)
);

CREATE UNIQUE INDEX "package_receptions_organization_id_package_id_key"
  ON "package_receptions"("organization_id", "package_id");

CREATE INDEX "package_receptions_org_facility_received_at_idx"
  ON "package_receptions"("organization_id", "facility_id", "received_at");

CREATE INDEX "package_receptions_org_received_by_employee_id_idx"
  ON "package_receptions"("organization_id", "received_by_employee_id");

ALTER TABLE "package_receptions"
  ADD CONSTRAINT "package_receptions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "package_receptions"
  ADD CONSTRAINT "package_receptions_organization_id_package_id_fkey"
  FOREIGN KEY ("organization_id", "package_id")
  REFERENCES "packages"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "package_receptions"
  ADD CONSTRAINT "package_receptions_organization_id_facility_id_fkey"
  FOREIGN KEY ("organization_id", "facility_id")
  REFERENCES "facilities"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "package_receptions"
  ADD CONSTRAINT "package_receptions_organization_id_received_by_employee_id_fkey"
  FOREIGN KEY ("organization_id", "received_by_employee_id")
  REFERENCES "employees"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
