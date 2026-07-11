-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('RECORDED', 'APPLIED', 'VOID');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "invoice_line_type" AS ENUM ('TRANSPORT', 'STORAGE', 'INSURANCE', 'DELIVERY', 'HANDLING', 'OTHER');

-- CreateTable
CREATE TABLE "customer_invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "invoice_number" VARCHAR(40) NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'DRAFT',
    "currency_code" CHAR(3) NOT NULL,
    "subtotal_minor" BIGINT NOT NULL DEFAULT 0,
    "tax_minor" BIGINT NOT NULL DEFAULT 0,
    "total_minor" BIGINT NOT NULL DEFAULT 0,
    "balance_due_minor" BIGINT NOT NULL DEFAULT 0,
    "issued_at" TIMESTAMPTZ(3),
    "due_date" DATE,
    "voided_at" TIMESTAMPTZ(3),
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "type" "invoice_line_type" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_minor" BIGINT NOT NULL,
    "total_price_minor" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "payment_number" VARCHAR(40) NOT NULL,
    "method" "payment_method" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "reference" VARCHAR(120),
    "status" "payment_status" NOT NULL DEFAULT 'RECORDED',
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "applied_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_invoices_org_customer_id_idx" ON "customer_invoices"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "customer_invoices_org_status_idx" ON "customer_invoices"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_invoices_org_invoice_number_key" ON "customer_invoices"("organization_id", "invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "customer_invoices_organization_id_id_key" ON "customer_invoices"("organization_id", "id");

-- CreateIndex
CREATE INDEX "invoice_lines_org_invoice_id_idx" ON "invoice_lines"("organization_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_organization_id_id_key" ON "invoice_lines"("organization_id", "id");

-- CreateIndex
CREATE INDEX "payments_org_customer_id_idx" ON "payments"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "payments_org_status_idx" ON "payments"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_org_payment_number_key" ON "payments"("organization_id", "payment_number");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organization_id_id_key" ON "payments"("organization_id", "id");

-- CreateIndex
CREATE INDEX "payment_allocations_org_payment_id_idx" ON "payment_allocations"("organization_id", "payment_id");

-- CreateIndex
CREATE INDEX "payment_allocations_org_invoice_id_idx" ON "payment_allocations"("organization_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_organization_id_id_key" ON "payment_allocations"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_org_customer_id_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_org_invoice_id_fkey" FOREIGN KEY ("organization_id", "invoice_id") REFERENCES "customer_invoices"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_customer_id_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_org_payment_id_fkey" FOREIGN KEY ("organization_id", "payment_id") REFERENCES "payments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_org_invoice_id_fkey" FOREIGN KEY ("organization_id", "invoice_id") REFERENCES "customer_invoices"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
