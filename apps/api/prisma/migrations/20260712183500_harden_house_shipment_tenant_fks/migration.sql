ALTER TABLE "house_shipments"
  DROP CONSTRAINT "house_shipments_dispatch_id_fkey",
  ADD CONSTRAINT "house_shipments_org_dispatch_id_fkey"
  FOREIGN KEY ("organization_id", "dispatch_id")
  REFERENCES "dispatches"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "house_shipment_packages"
  DROP CONSTRAINT "house_shipment_packages_house_shipment_id_fkey",
  DROP CONSTRAINT "house_shipment_packages_package_id_fkey",
  ADD CONSTRAINT "hs_packages_org_house_shipment_id_fkey"
  FOREIGN KEY ("organization_id", "house_shipment_id")
  REFERENCES "house_shipments"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "hs_packages_org_package_id_fkey"
  FOREIGN KEY ("organization_id", "package_id")
  REFERENCES "packages"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
