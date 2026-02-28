-- Update can_see_invoice to use producer_user_id (secure) instead of parsing service_description
-- Also add operations_room_members check for consistency with application logic
CREATE OR REPLACE FUNCTION can_see_invoice(inv_id uuid, uid uuid)
RETURNS boolean AS $$
DECLARE
  p profiles;
  inv invoices;
  wf invoice_workflows;
  is_other boolean;
  or_member boolean;
BEGIN
  SELECT * INTO p FROM profiles WHERE id = uid AND is_active = true;
  IF p IS NULL THEN RETURN false; END IF;

  SELECT * INTO inv FROM invoices WHERE id = inv_id;
  IF inv IS NULL THEN RETURN false; END IF;

  SELECT * INTO wf FROM invoice_workflows WHERE invoice_id = inv_id;

  -- Admin and operations see all
  IF p.role = 'admin' OR p.role = 'operations' THEN RETURN true; END IF;

  -- Viewer: see all except other_invoices unless allowed_pages includes it
  IF p.role = 'viewer' THEN
    is_other := (inv.invoice_type = 'other');
    IF is_other AND NOT (COALESCE(p.allowed_pages, ARRAY[]::text[]) @> ARRAY['other_invoices']) THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  -- Submitter sees own
  IF p.role = 'submitter' THEN
    RETURN inv.submitter_user_id = uid;
  END IF;

  -- Producer: see invoices where producer_user_id = self (secure; no text parsing)
  IF inv.producer_user_id = uid THEN RETURN true; END IF;

  -- Manager sees assigned
  IF p.role = 'manager' THEN
    RETURN wf.manager_user_id = uid;
  END IF;

  -- Finance sees payment-stage
  IF p.role = 'finance' THEN
    RETURN wf.status IN ('ready_for_payment', 'paid', 'archived');
  END IF;

  -- Operations room members see all (for freelancer approval flow)
  SELECT EXISTS (SELECT 1 FROM operations_room_members WHERE user_id = uid) INTO or_member;
  IF or_member THEN RETURN true; END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
