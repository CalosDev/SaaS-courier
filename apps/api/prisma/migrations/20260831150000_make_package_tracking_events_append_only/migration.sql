CREATE OR REPLACE FUNCTION prevent_package_tracking_event_mutation()
RETURNS trigger AS $$
BEGIN
  IF current_setting('app.allow_append_only_cleanup', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'package_tracking_events are append-only'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER package_tracking_events_append_only
BEFORE UPDATE OR DELETE ON package_tracking_events
FOR EACH ROW EXECUTE FUNCTION prevent_package_tracking_event_mutation();
