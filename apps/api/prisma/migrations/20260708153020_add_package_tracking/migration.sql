-- CreateEnum
CREATE TYPE "TrackingEventType" AS ENUM ('RECEIVED_AT_ORIGIN', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION');

-- CreateTable
CREATE TABLE "package_tracking_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "event_type" "TrackingEventType" NOT NULL,
    "location" VARCHAR(200),
    "description" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pkg_trk_events_org_pkg_created_idx" ON "package_tracking_events"("organization_id", "package_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pkg_trk_events_org_id_id_key" ON "package_tracking_events"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "package_tracking_events" ADD CONSTRAINT "pkg_trk_events_org_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_tracking_events" ADD CONSTRAINT "pkg_trk_events_org_pkg_id_fkey" FOREIGN KEY ("organization_id", "package_id") REFERENCES "packages"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_tracking_events" ADD CONSTRAINT "pkg_trk_events_created_by_fkey" FOREIGN KEY ("organization_id", "created_by_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
