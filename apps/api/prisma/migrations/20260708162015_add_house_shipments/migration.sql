-- CreateEnum
CREATE TYPE "house_shipment_status" AS ENUM ('DRAFT', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "customs_manifest_status" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "dispatches" ADD COLUMN     "mawb" VARCHAR(120);

-- AlterTable
ALTER TABLE "packages" ADD COLUMN     "customs_manifest_id" UUID;

-- CreateTable
CREATE TABLE "house_shipments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dispatch_id" UUID NOT NULL,
    "hawb" VARCHAR(120) NOT NULL,
    "status" "house_shipment_status" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "house_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "house_shipment_packages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "house_shipment_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "house_shipment_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_manifests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "flight_number" VARCHAR(40),
    "arrival_date" DATE,
    "status" "customs_manifest_status" NOT NULL DEFAULT 'DRAFT',
    "total_packages" INTEGER NOT NULL DEFAULT 0,
    "total_weight_minor" BIGINT NOT NULL DEFAULT 0,
    "total_value_minor" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "customs_manifests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "house_shipments_org_dispatch_idx" ON "house_shipments"("organization_id", "dispatch_id");

-- CreateIndex
CREATE UNIQUE INDEX "house_shipments_org_hawb_key" ON "house_shipments"("organization_id", "hawb");

-- CreateIndex
CREATE UNIQUE INDEX "house_shipments_org_id_key" ON "house_shipments"("organization_id", "id");

-- CreateIndex
CREATE INDEX "hs_packages_org_hs_idx" ON "house_shipment_packages"("organization_id", "house_shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "hs_packages_org_package_key" ON "house_shipment_packages"("organization_id", "package_id");

-- CreateIndex
CREATE INDEX "customs_manifests_org_status_idx" ON "customs_manifests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "customs_manifests_org_deleted_at_idx" ON "customs_manifests"("organization_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "customs_manifests_org_code_key" ON "customs_manifests"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "customs_manifests_organization_id_id_key" ON "customs_manifests"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "house_shipments" ADD CONSTRAINT "house_shipments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_shipments" ADD CONSTRAINT "house_shipments_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_shipment_packages" ADD CONSTRAINT "house_shipment_packages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_shipment_packages" ADD CONSTRAINT "house_shipment_packages_house_shipment_id_fkey" FOREIGN KEY ("house_shipment_id") REFERENCES "house_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_shipment_packages" ADD CONSTRAINT "house_shipment_packages_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_manifests" ADD CONSTRAINT "customs_manifests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_org_customs_manifest_id_fkey" FOREIGN KEY ("organization_id", "customs_manifest_id") REFERENCES "customs_manifests"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
