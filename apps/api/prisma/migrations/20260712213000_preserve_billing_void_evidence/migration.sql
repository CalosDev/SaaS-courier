ALTER TABLE "customer_invoices" ADD COLUMN "void_reason" VARCHAR(500);
ALTER TABLE "payments" ADD COLUMN "void_reason" VARCHAR(500);
ALTER TABLE "payment_allocations"
  ADD COLUMN "reversed_at" TIMESTAMPTZ(3),
  ADD COLUMN "reversal_reason" VARCHAR(500);

CREATE INDEX "payment_allocations_org_payment_reversed_idx"
  ON "payment_allocations"("organization_id", "payment_id", "reversed_at");
