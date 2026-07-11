-- CreateEnum
CREATE TYPE "dispatch_status" AS ENUM ('DRAFT', 'DEPARTED', 'ARRIVED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "packages" ADD COLUMN     "dispatch_id" UUID;

-- CreateTable
CREATE TABLE "dispatches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dispatch_code" VARCHAR(40) NOT NULL,
    "status" "dispatch_status" NOT NULL DEFAULT 'DRAFT',
    "origin" VARCHAR(120),
    "destination" VARCHAR(120),
    "carrier" VARCHAR(120),
    "flight_number" VARCHAR(40),
    "departure_time" TIMESTAMPTZ(3),
    "estimated_arrival_time" TIMESTAMPTZ(3),
    "actual_arrival_time" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispatches_org_status_idx" ON "dispatches"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_org_code_key" ON "dispatches"("organization_id", "dispatch_code");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_org_id_key" ON "dispatches"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_organization_id_dispatch_id_fkey" FOREIGN KEY ("organization_id", "dispatch_id") REFERENCES "dispatches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
