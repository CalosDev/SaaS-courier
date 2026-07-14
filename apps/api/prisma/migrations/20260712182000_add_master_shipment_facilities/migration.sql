CREATE TYPE "transport_mode" AS ENUM ('AIR', 'SEA', 'GROUND');

ALTER TABLE "dispatches"
  ADD COLUMN "origin_facility_id" UUID,
  ADD COLUMN "destination_facility_id" UUID,
  ADD COLUMN "transport_mode" "transport_mode" NOT NULL DEFAULT 'AIR';

CREATE INDEX "dispatches_org_origin_facility_idx"
  ON "dispatches"("organization_id", "origin_facility_id");
CREATE INDEX "dispatches_org_destination_facility_idx"
  ON "dispatches"("organization_id", "destination_facility_id");

ALTER TABLE "dispatches"
  ADD CONSTRAINT "dispatches_org_origin_facility_id_fkey"
  FOREIGN KEY ("organization_id", "origin_facility_id")
  REFERENCES "facilities"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dispatches"
  ADD CONSTRAINT "dispatches_org_destination_facility_id_fkey"
  FOREIGN KEY ("organization_id", "destination_facility_id")
  REFERENCES "facilities"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dispatches"
  ADD CONSTRAINT "dispatches_distinct_facilities_check"
  CHECK (
    "origin_facility_id" IS NULL
    OR "destination_facility_id" IS NULL
    OR "origin_facility_id" <> "destination_facility_id"
  );
