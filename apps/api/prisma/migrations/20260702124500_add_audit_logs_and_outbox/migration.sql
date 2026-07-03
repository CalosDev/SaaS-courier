CREATE TYPE "audit_actor_type" AS ENUM ('EMPLOYEE', 'SYSTEM', 'INTEGRATION');
CREATE TYPE "audit_source" AS ENUM ('HTTP', 'JOB', 'IMPORT', 'SYSTEM');
CREATE TYPE "outbox_event_status" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'DEAD_LETTER');

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_type" "audit_actor_type" NOT NULL,
    "actor_user_id" UUID,
    "actor_employee_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" VARCHAR(128) NOT NULL,
    "source" "audit_source" NOT NULL,
    "request_id" UUID NOT NULL,
    "correlation_id" VARCHAR(100) NOT NULL,
    "changed_fields" JSONB NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "reason" VARCHAR(500),
    "metadata" JSONB,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_action_not_empty" CHECK (length(btrim("action")) > 0),
    CONSTRAINT "audit_logs_entity_type_not_empty" CHECK (length(btrim("entity_type")) > 0),
    CONSTRAINT "audit_logs_entity_id_not_empty" CHECK (length(btrim("entity_id")) > 0),
    CONSTRAINT "audit_logs_correlation_id_not_empty" CHECK (length(btrim("correlation_id")) > 0),
    CONSTRAINT "audit_logs_changed_fields_array" CHECK (jsonb_typeof("changed_fields") = 'array'),
    CONSTRAINT "audit_logs_before_data_object" CHECK ("before_data" IS NULL OR jsonb_typeof("before_data") = 'object'),
    CONSTRAINT "audit_logs_after_data_object" CHECK ("after_data" IS NULL OR jsonb_typeof("after_data") = 'object'),
    CONSTRAINT "audit_logs_metadata_object" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
    CONSTRAINT "audit_logs_employee_actor_required" CHECK (
      "actor_type" <> 'EMPLOYEE' OR ("actor_user_id" IS NOT NULL AND "actor_employee_id" IS NOT NULL)
    )
);

CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" VARCHAR(128) NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "metadata" JSONB,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "status" "outbox_event_status" NOT NULL DEFAULT 'PENDING',
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "available_at" TIMESTAMPTZ(3) NOT NULL,
    "locked_by" VARCHAR(120),
    "locked_until" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processing_started_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "dead_lettered_at" TIMESTAMPTZ(3),
    "last_error_code" VARCHAR(120),
    "last_error_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outbox_events_event_type_not_empty" CHECK (length(btrim("event_type")) > 0),
    CONSTRAINT "outbox_events_aggregate_type_not_empty" CHECK (length(btrim("aggregate_type")) > 0),
    CONSTRAINT "outbox_events_aggregate_id_not_empty" CHECK (length(btrim("aggregate_id")) > 0),
    CONSTRAINT "outbox_events_idempotency_key_not_empty" CHECK (length(btrim("idempotency_key")) > 0),
    CONSTRAINT "outbox_events_schema_version_positive" CHECK ("schema_version" > 0),
    CONSTRAINT "outbox_events_payload_object" CHECK (jsonb_typeof("payload") = 'object'),
    CONSTRAINT "outbox_events_metadata_object" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
    CONSTRAINT "outbox_events_attempts_non_negative" CHECK ("attempts" >= 0),
    CONSTRAINT "outbox_events_published_at_required" CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL),
    CONSTRAINT "outbox_events_dead_lettered_at_required" CHECK ("status" <> 'DEAD_LETTER' OR "dead_lettered_at" IS NOT NULL),
    CONSTRAINT "outbox_events_pending_delivery_dates_empty" CHECK (
      "status" <> 'PENDING' OR ("published_at" IS NULL AND "dead_lettered_at" IS NULL)
    )
);

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "audit_logs_organization_id_occurred_at_idx" ON "audit_logs"("organization_id", "occurred_at");
CREATE INDEX "audit_logs_org_entity_occurred_at_idx" ON "audit_logs"("organization_id", "entity_type", "entity_id", "occurred_at");
CREATE INDEX "audit_logs_org_actor_occurred_at_idx" ON "audit_logs"("organization_id", "actor_employee_id", "occurred_at");
CREATE INDEX "audit_logs_org_action_occurred_at_idx" ON "audit_logs"("organization_id", "action", "occurred_at");
CREATE INDEX "audit_logs_org_correlation_id_idx" ON "audit_logs"("organization_id", "correlation_id");
CREATE UNIQUE INDEX "outbox_events_organization_id_idempotency_key_key" ON "outbox_events"("organization_id", "idempotency_key");
CREATE INDEX "outbox_events_status_available_at_created_at_idx" ON "outbox_events"("status", "available_at", "created_at");
CREATE INDEX "outbox_events_org_aggregate_idx" ON "outbox_events"("organization_id", "aggregate_type", "aggregate_id");
CREATE INDEX "outbox_events_organization_id_occurred_at_idx" ON "outbox_events"("organization_id", "occurred_at");

CREATE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.audit_mutation_bypass', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_logs are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE FUNCTION prevent_outbox_event_content_mutation() RETURNS trigger AS $$
BEGIN
  IF NEW."organization_id" IS DISTINCT FROM OLD."organization_id"
    OR NEW."event_type" IS DISTINCT FROM OLD."event_type"
    OR NEW."aggregate_type" IS DISTINCT FROM OLD."aggregate_type"
    OR NEW."aggregate_id" IS DISTINCT FROM OLD."aggregate_id"
    OR NEW."schema_version" IS DISTINCT FROM OLD."schema_version"
    OR NEW."payload" IS DISTINCT FROM OLD."payload"
    OR NEW."metadata" IS DISTINCT FROM OLD."metadata"
    OR NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
    OR NEW."occurred_at" IS DISTINCT FROM OLD."occurred_at"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'outbox event identity and content are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER outbox_events_content_immutable
BEFORE UPDATE ON "outbox_events"
FOR EACH ROW EXECUTE FUNCTION prevent_outbox_event_content_mutation();
