CREATE OR REPLACE FUNCTION enforce_package_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF
    (OLD.status = 'RECEPTION_PENDING' AND NEW.status IN ('RECEIVED_AT_ORIGIN', 'CANCELLED'))
    OR (OLD.status = 'RECEIVED_AT_ORIGIN' AND NEW.status = 'IN_TRANSIT')
    OR (OLD.status = 'IN_TRANSIT' AND NEW.status = 'ARRIVED_AT_DESTINATION')
    OR (OLD.status = 'ARRIVED_AT_DESTINATION' AND NEW.status IN ('IN_TRANSIT', 'OUT_FOR_DELIVERY'))
    OR (OLD.status = 'OUT_FOR_DELIVERY' AND NEW.status IN ('DELIVERED', 'ARRIVED_AT_DESTINATION'))
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid package status transition: % -> %', OLD.status, NEW.status
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS packages_enforce_status_transition ON packages;

CREATE TRIGGER packages_enforce_status_transition
BEFORE UPDATE OF status ON packages
FOR EACH ROW
EXECUTE FUNCTION enforce_package_status_transition();
