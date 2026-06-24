-- CreateEnum
CREATE TYPE "organization_status" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "facility_type" AS ENUM ('INTERNATIONAL_WAREHOUSE', 'DISTRIBUTION_CENTER', 'BRANCH', 'AGENCY', 'PICKUP_POINT', 'OFFICE', 'CUSTOMS_WAREHOUSE');

-- CreateEnum
CREATE TYPE "facility_ownership_type" AS ENUM ('OWNED', 'AGENCY', 'PARTNER');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "commercial_name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "rnc" VARCHAR(20),
    "email" VARCHAR(320),
    "phone" VARCHAR(32),
    "country_code" CHAR(2) NOT NULL DEFAULT 'DO',
    "currency_code" CHAR(3) NOT NULL DEFAULT 'DOP',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Santo_Domingo',
    "status" "organization_status" NOT NULL DEFAULT 'TRIAL',
    "plan_code" VARCHAR(40) NOT NULL DEFAULT 'PILOT',
    "max_users" INTEGER NOT NULL DEFAULT 5,
    "max_facilities" INTEGER NOT NULL DEFAULT 2,
    "trial_ends_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "facility_type" NOT NULL,
    "ownership_type" "facility_ownership_type" NOT NULL DEFAULT 'OWNED',
    "country_code" CHAR(2) NOT NULL DEFAULT 'DO',
    "province" VARCHAR(80),
    "city" VARCHAR(80),
    "address_line_1" VARCHAR(200),
    "address_line_2" VARCHAR(200),
    "phone" VARCHAR(32),
    "email" VARCHAR(320),
    "is_customer_facing" BOOLEAN NOT NULL DEFAULT true,
    "is_package_origin" BOOLEAN NOT NULL DEFAULT false,
    "is_distribution_center" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraints
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_legal_name_non_empty" CHECK (length(btrim("legal_name")) > 0);
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_commercial_name_non_empty" CHECK (length(btrim("commercial_name")) > 0);
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_country_code_format" CHECK ("country_code" ~ '^[A-Z]{2}$');
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_currency_code_format" CHECK ("currency_code" ~ '^[A-Z]{3}$');
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_max_users_positive" CHECK ("max_users" > 0);
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_max_facilities_positive" CHECK ("max_facilities" > 0);
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_name_non_empty" CHECK (length(btrim("name")) > 0);
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_code_format" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$');
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_country_code_format" CHECK ("country_code" ~ '^[A-Z]{2}$');

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE INDEX "organizations_deleted_at_idx" ON "organizations"("deleted_at");

-- CreateIndex
CREATE INDEX "facilities_organization_id_type_idx" ON "facilities"("organization_id", "type");

-- CreateIndex
CREATE INDEX "facilities_organization_id_is_active_idx" ON "facilities"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "facilities_organization_id_deleted_at_idx" ON "facilities"("organization_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "facilities_organization_id_code_key" ON "facilities"("organization_id", "code");

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
