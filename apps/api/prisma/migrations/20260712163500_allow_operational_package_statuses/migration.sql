ALTER TABLE "packages"
  DROP CONSTRAINT "packages_cancelled_consistency";

ALTER TABLE "packages"
  ADD CONSTRAINT "packages_cancelled_consistency" CHECK (
    (
      "status" IN (
        'RECEPTION_PENDING',
        'RECEIVED_AT_ORIGIN',
        'IN_TRANSIT',
        'ARRIVED_AT_DESTINATION',
        'OUT_FOR_DELIVERY',
        'DELIVERED'
      )
      AND "cancelled_at" IS NULL
      AND "cancelled_by_employee_id" IS NULL
      AND "cancellation_reason" IS NULL
    )
    OR
    (
      "status" = 'CANCELLED'
      AND "cancelled_at" IS NOT NULL
      AND "cancelled_by_employee_id" IS NOT NULL
      AND length(btrim("cancellation_reason")) BETWEEN 3 AND 500
    )
  );
