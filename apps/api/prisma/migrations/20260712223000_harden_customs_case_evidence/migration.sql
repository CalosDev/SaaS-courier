ALTER TABLE "customs_case_events"
  ADD COLUMN "evidence_reference" VARCHAR(200),
  ADD COLUMN "recorded_by_employee_id" UUID;

ALTER TABLE "customs_case_events"
  ADD CONSTRAINT "customs_case_events_recorded_by_fkey"
  FOREIGN KEY ("organization_id", "recorded_by_employee_id")
  REFERENCES "employees"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_customs_case_event_mutation()
RETURNS trigger AS $$
BEGIN
  IF current_setting('app.allow_append_only_cleanup', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'customs_case_events are append-only'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customs_case_events_append_only
BEFORE UPDATE OR DELETE ON "customs_case_events"
FOR EACH ROW EXECUTE FUNCTION prevent_customs_case_event_mutation();
