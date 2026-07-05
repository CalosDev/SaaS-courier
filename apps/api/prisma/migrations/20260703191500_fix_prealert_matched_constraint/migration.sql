ALTER TABLE "prealerts"
  DROP CONSTRAINT "prealerts_cancelled_consistency";

ALTER TABLE "prealerts"
  ADD CONSTRAINT "prealerts_cancelled_consistency" CHECK (
    (
      "status" IN ('PENDING_ARRIVAL', 'MATCHED')
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
