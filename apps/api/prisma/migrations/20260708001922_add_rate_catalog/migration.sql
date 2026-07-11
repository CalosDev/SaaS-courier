-- CreateEnum
CREATE TYPE "rate_calculation_type" AS ENUM ('FLAT', 'PER_WEIGHT', 'TIERED_WEIGHT', 'PER_PIECE');

-- CreateEnum
CREATE TYPE "rate_rule_status" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateTable
CREATE TABLE "courier_services" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courier_services_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "courier_services_code_format_chk" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'),
    CONSTRAINT "courier_services_name_length_chk" CHECK (length(btrim("name")) BETWEEN 2 AND 120)
);

-- CreateTable
CREATE TABLE "rate_cards" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "previous_rate_card_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "segment_key" VARCHAR(40) NOT NULL,
    "segment_name" VARCHAR(120) NOT NULL,
    "calculation_type" "rate_calculation_type" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "rate_rule_status" NOT NULL DEFAULT 'DRAFT',
    "currency_code" CHAR(3) NOT NULL,
    "weight_unit" "weight_unit" NOT NULL,
    "effective_from" TIMESTAMPTZ(3),
    "effective_to" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_cards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rate_cards_segment_key_format_chk" CHECK ("segment_key" ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'),
    CONSTRAINT "rate_cards_name_length_chk" CHECK (length(btrim("name")) BETWEEN 2 AND 120),
    CONSTRAINT "rate_cards_segment_name_length_chk" CHECK (length(btrim("segment_name")) BETWEEN 2 AND 120),
    CONSTRAINT "rate_cards_currency_code_format_chk" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
    CONSTRAINT "rate_cards_version_positive_chk" CHECK ("version" > 0),
    CONSTRAINT "rate_cards_status_timeline_consistency_chk" CHECK (
      ("status" = 'DRAFT' AND "effective_from" IS NULL AND "effective_to" IS NULL)
      OR
      ("status" = 'ACTIVE' AND "effective_from" IS NOT NULL AND ("effective_to" IS NULL OR "effective_to" > "effective_from"))
      OR
      ("status" = 'RETIRED' AND "effective_from" IS NOT NULL AND "effective_to" IS NOT NULL AND "effective_to" > "effective_from")
    )
);

-- CreateTable
CREATE TABLE "rate_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "rate_card_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "min_weight" DECIMAL(12,3),
    "max_weight" DECIMAL(12,3),
    "flat_amount_minor" BIGINT,
    "unit_amount_minor" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rate_rules_sort_order_positive_chk" CHECK ("sort_order" > 0),
    CONSTRAINT "rate_rules_min_weight_non_negative_chk" CHECK ("min_weight" IS NULL OR "min_weight" >= 0),
    CONSTRAINT "rate_rules_max_weight_positive_chk" CHECK ("max_weight" IS NULL OR "max_weight" > 0),
    CONSTRAINT "rate_rules_weight_bounds_chk" CHECK ("min_weight" IS NULL OR "max_weight" IS NULL OR "max_weight" > "min_weight"),
    CONSTRAINT "rate_rules_flat_amount_non_negative_chk" CHECK ("flat_amount_minor" IS NULL OR "flat_amount_minor" >= 0),
    CONSTRAINT "rate_rules_unit_amount_positive_chk" CHECK ("unit_amount_minor" IS NULL OR "unit_amount_minor" > 0)
);

-- CreateIndex
CREATE INDEX "courier_services_organization_id_is_active_idx" ON "courier_services"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "courier_services_organization_id_code_key" ON "courier_services"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "courier_services_organization_id_id_key" ON "courier_services"("organization_id", "id");

-- CreateIndex
CREATE INDEX "rate_cards_organization_id_service_id_status_idx" ON "rate_cards"("organization_id", "service_id", "status");

-- CreateIndex
CREATE INDEX "rate_cards_org_service_segment_status_idx" ON "rate_cards"("organization_id", "service_id", "segment_key", "status");

-- CreateIndex
CREATE INDEX "rate_cards_organization_id_previous_rate_card_id_idx" ON "rate_cards"("organization_id", "previous_rate_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_cards_organization_id_id_key" ON "rate_cards"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_cards_org_service_segment_version_key" ON "rate_cards"("organization_id", "service_id", "segment_key", "version");

CREATE UNIQUE INDEX "rate_cards_one_draft_per_segment_key"
  ON "rate_cards"("organization_id", "service_id", "segment_key")
  WHERE "status" = 'DRAFT';

ALTER TABLE "rate_cards"
  ADD CONSTRAINT "rate_cards_no_overlap_per_service_segment"
  EXCLUDE USING gist (
    "organization_id" WITH =,
    "service_id" WITH =,
    "segment_key" WITH =,
    tstzrange("effective_from", COALESCE("effective_to", 'infinity'::timestamptz), '[)') WITH &&
  )
  WHERE ("status" <> 'DRAFT');

-- CreateIndex
CREATE INDEX "rate_rules_organization_id_rate_card_id_idx" ON "rate_rules"("organization_id", "rate_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_rules_organization_id_id_key" ON "rate_rules"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_rules_org_rate_card_sort_order_key" ON "rate_rules"("organization_id", "rate_card_id", "sort_order");

-- AddForeignKey
ALTER TABLE "courier_services" ADD CONSTRAINT "courier_services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_organization_id_service_id_fkey" FOREIGN KEY ("organization_id", "service_id") REFERENCES "courier_services"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_previous_rate_card_id_fkey" FOREIGN KEY ("organization_id", "previous_rate_card_id") REFERENCES "rate_cards"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_rules" ADD CONSTRAINT "rate_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_rules" ADD CONSTRAINT "rate_rules_organization_id_rate_card_id_fkey" FOREIGN KEY ("organization_id", "rate_card_id") REFERENCES "rate_cards"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
