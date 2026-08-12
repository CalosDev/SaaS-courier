CREATE TYPE "courier_registration_status" AS ENUM (
  'UNKNOWN',
  'IN_PROCESS',
  'AUTHORIZED',
  'SUSPENDED',
  'REVOKED'
);

CREATE TYPE "electronic_invoicing_status" AS ENUM (
  'UNKNOWN',
  'NOT_ENROLLED',
  'IN_PROCESS',
  'ENABLED',
  'EXEMPT'
);

CREATE TABLE "organization_regulatory_profiles" (
  "organization_id" UUID NOT NULL,
  "fiscal_address" VARCHAR(500),
  "authorized_representative_name" VARCHAR(200),
  "authorized_representative_email" VARCHAR(320),
  "authorized_representative_phone" VARCHAR(32),
  "courier_registration_status" "courier_registration_status" NOT NULL DEFAULT 'UNKNOWN',
  "dga_operator_code" VARCHAR(80),
  "electronic_invoicing_status" "electronic_invoicing_status" NOT NULL DEFAULT 'UNKNOWN',
  "declared_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_regulatory_profiles_pkey" PRIMARY KEY ("organization_id"),
  CONSTRAINT "organization_regulatory_profiles_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "organization_regulatory_profiles_courier_status_idx"
  ON "organization_regulatory_profiles"("courier_registration_status");

CREATE INDEX "organization_regulatory_profiles_invoicing_status_idx"
  ON "organization_regulatory_profiles"("electronic_invoicing_status");

INSERT INTO "organization_regulatory_profiles" ("organization_id")
SELECT "id"
FROM "organizations"
WHERE "deleted_at" IS NULL
ON CONFLICT ("organization_id") DO NOTHING;
