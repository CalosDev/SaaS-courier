ALTER TYPE "customs_manifest_status" ADD VALUE IF NOT EXISTS 'VALIDATED';
ALTER TYPE "customs_manifest_status" ADD VALUE IF NOT EXISTS 'FINALIZED';
CREATE TYPE "customs_manifest_validation_status" AS ENUM ('PENDING', 'VALID', 'INVALID');

ALTER TABLE "customs_manifests"
  ADD COLUMN "dispatch_id" UUID,
  ADD COLUMN "current_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "finalized_version_id" UUID;

CREATE TABLE "customs_manifest_versions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "manifest_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "validation_status" "customs_manifest_validation_status" NOT NULL DEFAULT 'PENDING',
  "validation_errors" JSONB,
  "shipment_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customs_manifest_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customs_manifest_items" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "version_id" UUID NOT NULL,
  "package_id" UUID NOT NULL,
  "item_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customs_manifest_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customs_manifest_versions_org_id_key" ON "customs_manifest_versions"("organization_id", "id");
CREATE UNIQUE INDEX "customs_manifest_versions_org_manifest_version_key" ON "customs_manifest_versions"("organization_id", "manifest_id", "version_number");
CREATE INDEX "customs_manifest_versions_org_manifest_created_idx" ON "customs_manifest_versions"("organization_id", "manifest_id", "created_at");
CREATE UNIQUE INDEX "customs_manifest_items_org_version_package_key" ON "customs_manifest_items"("organization_id", "version_id", "package_id");
CREATE INDEX "customs_manifest_items_org_version_idx" ON "customs_manifest_items"("organization_id", "version_id");
CREATE INDEX "customs_manifests_org_dispatch_idx" ON "customs_manifests"("organization_id", "dispatch_id");

ALTER TABLE "customs_manifests" ADD CONSTRAINT "customs_manifests_org_dispatch_id_fkey" FOREIGN KEY ("organization_id", "dispatch_id") REFERENCES "dispatches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customs_manifest_versions" ADD CONSTRAINT "customs_manifest_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customs_manifest_versions" ADD CONSTRAINT "customs_manifest_versions_org_manifest_id_fkey" FOREIGN KEY ("organization_id", "manifest_id") REFERENCES "customs_manifests"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customs_manifest_items" ADD CONSTRAINT "customs_manifest_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customs_manifest_items" ADD CONSTRAINT "customs_manifest_items_org_version_id_fkey" FOREIGN KEY ("organization_id", "version_id") REFERENCES "customs_manifest_versions"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customs_manifest_items" ADD CONSTRAINT "customs_manifest_items_org_package_id_fkey" FOREIGN KEY ("organization_id", "package_id") REFERENCES "packages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customs_manifests" ADD CONSTRAINT "customs_manifests_org_finalized_version_id_fkey" FOREIGN KEY ("organization_id", "finalized_version_id") REFERENCES "customs_manifest_versions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
