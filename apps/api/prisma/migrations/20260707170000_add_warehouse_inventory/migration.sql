-- CreateEnum
CREATE TYPE "warehouse_location_type" AS ENUM ('RECEIVING', 'SHELF', 'RACK', 'BIN', 'STAGING', 'HOLD', 'DISPATCH');

-- CreateEnum
CREATE TYPE "inventory_movement_type" AS ENUM ('PUTAWAY', 'MOVE', 'HOLD', 'RELEASE', 'REMOVE');

-- CreateTable
CREATE TABLE "warehouse_locations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "warehouse_location_type" NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_locations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "warehouse_locations_code_format_chk" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$')
);

-- CreateTable
CREATE TABLE "package_inventory_positions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "placed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_inventory_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "from_location_id" UUID,
    "to_location_id" UUID,
    "moved_by_employee_id" UUID NOT NULL,
    "movement_type" "inventory_movement_type" NOT NULL,
    "note" VARCHAR(500),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_movements_has_endpoint_chk" CHECK ("from_location_id" IS NOT NULL OR "to_location_id" IS NOT NULL)
);

-- CreateIndex
CREATE INDEX "warehouse_locations_org_facility_active_idx" ON "warehouse_locations"("organization_id", "facility_id", "is_active");

-- CreateIndex
CREATE INDEX "warehouse_locations_org_type_active_idx" ON "warehouse_locations"("organization_id", "type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_locations_org_facility_code_key" ON "warehouse_locations"("organization_id", "facility_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_locations_organization_id_id_key" ON "warehouse_locations"("organization_id", "id");

-- CreateIndex
CREATE INDEX "package_inventory_positions_org_facility_idx" ON "package_inventory_positions"("organization_id", "facility_id");

-- CreateIndex
CREATE INDEX "package_inventory_positions_org_location_idx" ON "package_inventory_positions"("organization_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_inventory_positions_org_package_key" ON "package_inventory_positions"("organization_id", "package_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_inventory_positions_organization_id_id_key" ON "package_inventory_positions"("organization_id", "id");

-- CreateIndex
CREATE INDEX "inventory_movements_org_package_occurred_at_idx" ON "inventory_movements"("organization_id", "package_id", "occurred_at");

-- CreateIndex
CREATE INDEX "inventory_movements_org_facility_occurred_at_idx" ON "inventory_movements"("organization_id", "facility_id", "occurred_at");

-- CreateIndex
CREATE INDEX "inventory_movements_org_from_location_occurred_idx" ON "inventory_movements"("organization_id", "from_location_id", "occurred_at");

-- CreateIndex
CREATE INDEX "inventory_movements_org_to_location_occurred_idx" ON "inventory_movements"("organization_id", "to_location_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_organization_id_id_key" ON "inventory_movements"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_organization_id_facility_id_fkey" FOREIGN KEY ("organization_id", "facility_id") REFERENCES "facilities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_inventory_positions" ADD CONSTRAINT "package_inventory_positions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_inventory_positions" ADD CONSTRAINT "package_inventory_positions_organization_id_package_id_fkey" FOREIGN KEY ("organization_id", "package_id") REFERENCES "packages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_inventory_positions" ADD CONSTRAINT "package_inventory_positions_organization_id_facility_id_fkey" FOREIGN KEY ("organization_id", "facility_id") REFERENCES "facilities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_inventory_positions" ADD CONSTRAINT "package_inventory_positions_organization_id_location_id_fkey" FOREIGN KEY ("organization_id", "location_id") REFERENCES "warehouse_locations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_package_id_fkey" FOREIGN KEY ("organization_id", "package_id") REFERENCES "packages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_facility_id_fkey" FOREIGN KEY ("organization_id", "facility_id") REFERENCES "facilities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_from_location_id_fkey" FOREIGN KEY ("organization_id", "from_location_id") REFERENCES "warehouse_locations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_to_location_id_fkey" FOREIGN KEY ("organization_id", "to_location_id") REFERENCES "warehouse_locations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_moved_by_employee_id_fkey" FOREIGN KEY ("organization_id", "moved_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION ensure_package_inventory_position_location_facility() RETURNS trigger AS $$
DECLARE
  location_facility_id UUID;
BEGIN
  SELECT facility_id
    INTO location_facility_id
  FROM warehouse_locations
  WHERE organization_id = NEW.organization_id
    AND id = NEW.location_id;

  IF location_facility_id IS NULL THEN
    RAISE EXCEPTION 'inventory position location does not exist';
  END IF;

  IF location_facility_id IS DISTINCT FROM NEW.facility_id THEN
    RAISE EXCEPTION 'inventory position facility mismatch';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER package_inventory_positions_location_facility_check
BEFORE INSERT OR UPDATE ON "package_inventory_positions"
FOR EACH ROW EXECUTE FUNCTION ensure_package_inventory_position_location_facility();

CREATE FUNCTION ensure_inventory_movement_location_facility() RETURNS trigger AS $$
DECLARE
  origin_facility_id UUID;
  target_facility_id UUID;
BEGIN
  IF NEW.from_location_id IS NOT NULL THEN
    SELECT facility_id
      INTO origin_facility_id
    FROM warehouse_locations
    WHERE organization_id = NEW.organization_id
      AND id = NEW.from_location_id;

    IF origin_facility_id IS NULL THEN
      RAISE EXCEPTION 'inventory movement origin location does not exist';
    END IF;

    IF origin_facility_id IS DISTINCT FROM NEW.facility_id THEN
      RAISE EXCEPTION 'inventory movement origin facility mismatch';
    END IF;
  END IF;

  IF NEW.to_location_id IS NOT NULL THEN
    SELECT facility_id
      INTO target_facility_id
    FROM warehouse_locations
    WHERE organization_id = NEW.organization_id
      AND id = NEW.to_location_id;

    IF target_facility_id IS NULL THEN
      RAISE EXCEPTION 'inventory movement target location does not exist';
    END IF;

    IF target_facility_id IS DISTINCT FROM NEW.facility_id THEN
      RAISE EXCEPTION 'inventory movement target facility mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_movements_location_facility_check
BEFORE INSERT OR UPDATE ON "inventory_movements"
FOR EACH ROW EXECUTE FUNCTION ensure_inventory_movement_location_facility();

CREATE FUNCTION prevent_inventory_movement_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'inventory_movements are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_movements_immutable
BEFORE UPDATE OR DELETE ON "inventory_movements"
FOR EACH ROW EXECUTE FUNCTION prevent_inventory_movement_mutation();


