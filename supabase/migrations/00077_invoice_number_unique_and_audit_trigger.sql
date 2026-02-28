-- Audit append-only trigger: prevent UPDATE and DELETE on audit_events
-- Blocks all modifications including service role (defense in depth)
CREATE OR REPLACE FUNCTION prevent_audit_events_modify()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: UPDATE and DELETE are not allowed'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_prevent_modify ON audit_events;
CREATE TRIGGER audit_events_prevent_modify
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW
  EXECUTE PROCEDURE prevent_audit_events_modify();
