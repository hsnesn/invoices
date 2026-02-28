-- Fix: Invoice delete was failing because audit_events has invoice_id ON DELETE SET NULL.
-- When an invoice is deleted, Postgres UPDATEs audit_events to set invoice_id = NULL.
-- The prevent_audit_events_modify trigger blocked all UPDATEs, causing the delete to fail.
-- Allow this specific FK orphan-cleanup update (invoice_id -> NULL only).
CREATE OR REPLACE FUNCTION prevent_audit_events_modify()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow UPDATE when only invoice_id or actor_user_id is set to NULL (FK ON DELETE SET NULL)
  IF TG_OP = 'UPDATE' AND (
    (OLD.invoice_id IS NOT NULL AND NEW.invoice_id IS NULL AND OLD.actor_user_id IS NOT DISTINCT FROM NEW.actor_user_id) OR
    (OLD.actor_user_id IS NOT NULL AND NEW.actor_user_id IS NULL AND OLD.invoice_id IS NOT DISTINCT FROM NEW.invoice_id)
  ) AND OLD.event_type = NEW.event_type
     AND OLD.from_status IS NOT DISTINCT FROM NEW.from_status
     AND OLD.to_status IS NOT DISTINCT FROM NEW.to_status
     AND OLD.payload IS NOT DISTINCT FROM NEW.payload
     AND OLD.created_at = NEW.created_at
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'audit_events is append-only: UPDATE and DELETE are not allowed'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
