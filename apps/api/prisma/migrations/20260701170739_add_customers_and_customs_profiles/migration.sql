-- CreateEnum
CREATE TYPE "customer_type" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "customer_status" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "customer_address_type" AS ENUM ('HOME', 'WORK', 'BILLING', 'DELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "customer_identity_document_type" AS ENUM ('CEDULA', 'PASSPORT', 'RNC');

-- CreateEnum
CREATE TYPE "customs_registration_status" AS ENUM ('UNKNOWN', 'PENDING', 'REGISTERED', 'NOT_REGISTERED', 'VERIFICATION_FAILED');

-- CreateEnum
CREATE TYPE "customs_verification_source" AS ENUM ('MANUAL', 'DGA_PORTAL', 'OFFICIAL_INTEGRATION');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_code" VARCHAR(40) NOT NULL,
    "type" "customer_type" NOT NULL,
    "first_name" VARCHAR(120),
    "last_name" VARCHAR(120),
    "business_name" VARCHAR(200),
    "email" VARCHAR(320),
    "phone" VARCHAR(32),
    "mobile_phone" VARCHAR(32),
    "status" "customer_status" NOT NULL DEFAULT 'PENDING',
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" "customer_address_type" NOT NULL,
    "label" VARCHAR(120),
    "recipient_name" VARCHAR(160),
    "phone" VARCHAR(32),
    "address_line_1" VARCHAR(200) NOT NULL,
    "address_line_2" VARCHAR(200),
    "city" VARCHAR(80) NOT NULL,
    "province" VARCHAR(80) NOT NULL,
    "postal_code" VARCHAR(32),
    "country_code" CHAR(2) NOT NULL DEFAULT 'DO',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_customs_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "document_type" "customer_identity_document_type" NOT NULL,
    "document_number" VARCHAR(30) NOT NULL,
    "rua_status" "customs_registration_status" NOT NULL DEFAULT 'UNKNOWN',
    "verification_source" "customs_verification_source",
    "last_checked_at" TIMESTAMPTZ(3),
    "verified_at" TIMESTAMPTZ(3),
    "external_reference" VARCHAR(120),
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_customs_profiles_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraints
ALTER TABLE "customers"
    ADD CONSTRAINT "customers_customer_code_uppercase" CHECK ("customer_code" = upper("customer_code"));
ALTER TABLE "customers"
    ADD CONSTRAINT "customers_customer_code_format" CHECK ("customer_code" ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$');
ALTER TABLE "customers"
    ADD CONSTRAINT "customers_email_normalized" CHECK (
      "email" IS NULL OR ("email" = lower("email") AND "email" = btrim("email"))
    );
ALTER TABLE "customers"
    ADD CONSTRAINT "customers_name_requirements_by_type" CHECK (
      (
        "type" = 'INDIVIDUAL'
        AND length(btrim(coalesce("first_name", ''))) > 0
        AND length(btrim(coalesce("last_name", ''))) > 0
      ) OR (
        "type" = 'BUSINESS'
        AND length(btrim(coalesce("business_name", ''))) > 0
      )
    );

ALTER TABLE "customer_addresses"
    ADD CONSTRAINT "customer_addresses_address_line_1_non_empty" CHECK (length(btrim("address_line_1")) > 0);
ALTER TABLE "customer_addresses"
    ADD CONSTRAINT "customer_addresses_city_non_empty" CHECK (length(btrim("city")) > 0);
ALTER TABLE "customer_addresses"
    ADD CONSTRAINT "customer_addresses_province_non_empty" CHECK (length(btrim("province")) > 0);
ALTER TABLE "customer_addresses"
    ADD CONSTRAINT "customer_addresses_country_code_format" CHECK ("country_code" ~ '^[A-Z]{2}$');

ALTER TABLE "customer_customs_profiles"
    ADD CONSTRAINT "customer_customs_profiles_document_number_normalized" CHECK ("document_number" = btrim("document_number"));
ALTER TABLE "customer_customs_profiles"
    ADD CONSTRAINT "customer_customs_profiles_cedula_format" CHECK (
      "document_type" <> 'CEDULA' OR "document_number" ~ '^[0-9]{11}$'
    );
ALTER TABLE "customer_customs_profiles"
    ADD CONSTRAINT "customer_customs_profiles_rnc_format" CHECK (
      "document_type" <> 'RNC' OR "document_number" ~ '^([0-9]{9}|[0-9]{11})$'
    );
ALTER TABLE "customer_customs_profiles"
    ADD CONSTRAINT "customer_customs_profiles_passport_format" CHECK (
      "document_type" <> 'PASSPORT' OR "document_number" ~ '^[A-Z0-9-]{3,30}$'
    );
ALTER TABLE "customer_customs_profiles"
    ADD CONSTRAINT "customer_customs_profiles_registered_coherence" CHECK (
      "rua_status" <> 'REGISTERED' OR (
        "verification_source" IS NOT NULL
        AND "last_checked_at" IS NOT NULL
        AND "verified_at" IS NOT NULL
        AND "verified_at" = "last_checked_at"
      )
    );
ALTER TABLE "customer_customs_profiles"
    ADD CONSTRAINT "customer_customs_profiles_verified_at_non_registered_null" CHECK (
      "rua_status" = 'REGISTERED' OR "verified_at" IS NULL
    );
ALTER TABLE "customer_customs_profiles"
    ADD CONSTRAINT "customer_customs_profiles_negative_status_requirements" CHECK (
      "rua_status" NOT IN ('NOT_REGISTERED', 'VERIFICATION_FAILED') OR (
        "verification_source" IS NOT NULL
        AND "last_checked_at" IS NOT NULL
      )
    );
ALTER TABLE "customer_customs_profiles"
    ADD CONSTRAINT "customer_customs_profiles_unknown_clears_verification" CHECK (
      "rua_status" <> 'UNKNOWN' OR (
        "verification_source" IS NULL
        AND "last_checked_at" IS NULL
        AND "verified_at" IS NULL
        AND "external_reference" IS NULL
      )
    );

-- CreateIndex
CREATE INDEX "customers_organization_id_status_idx" ON "customers"("organization_id", "status");

-- CreateIndex
CREATE INDEX "customers_organization_id_type_idx" ON "customers"("organization_id", "type");

-- CreateIndex
CREATE INDEX "customers_organization_id_deleted_at_idx" ON "customers"("organization_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "customers_organization_id_customer_code_key" ON "customers"("organization_id", "customer_code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_organization_id_id_key" ON "customers"("organization_id", "id");

-- CreateIndex
CREATE INDEX "customer_addresses_organization_id_customer_id_idx" ON "customer_addresses"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "customer_addresses_organization_id_customer_id_type_idx" ON "customer_addresses"("organization_id", "customer_id", "type");

-- CreateIndex
CREATE INDEX "customer_addresses_organization_id_deleted_at_idx" ON "customer_addresses"("organization_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_addresses_organization_id_id_key" ON "customer_addresses"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_addresses_one_primary_per_type"
ON "customer_addresses"("organization_id", "customer_id", "type")
WHERE "is_primary" = true
  AND "deleted_at" IS NULL;

-- CreateIndex
CREATE INDEX "customer_customs_profiles_organization_id_rua_status_idx" ON "customer_customs_profiles"("organization_id", "rua_status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_customs_profiles_organization_id_customer_id_key" ON "customer_customs_profiles"("organization_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_customs_profiles_org_doc_key" ON "customer_customs_profiles"("organization_id", "document_type", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "customer_customs_profiles_organization_id_id_key" ON "customer_customs_profiles"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_organization_id_customer_id_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_customs_profiles" ADD CONSTRAINT "customer_customs_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_customs_profiles" ADD CONSTRAINT "customer_customs_profiles_organization_id_customer_id_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
