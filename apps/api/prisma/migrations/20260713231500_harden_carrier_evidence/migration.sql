CREATE OR REPLACE FUNCTION prevent_carrier_evidence_mutation()
RETURNS trigger AS $$
BEGIN
  IF current_setting('app.allow_append_only_cleanup', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER carrier_webhook_receipts_append_only
BEFORE UPDATE OR DELETE ON carrier_webhook_receipts
FOR EACH ROW EXECUTE FUNCTION prevent_carrier_evidence_mutation();

CREATE TRIGGER carrier_tracking_snapshots_append_only
BEFORE UPDATE OR DELETE ON carrier_tracking_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_carrier_evidence_mutation();
