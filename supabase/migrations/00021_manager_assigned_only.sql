-- Managers see only invoices assigned to them (not by department/program)
CREATE OR REPLACE FUNCTION can_see_invoice(inv_id uuid, uid uuid)
RETURNS boolean AS $$
DECLARE
  p profiles;
  inv invoices;
  wf invoice_workflows;
BEGIN
  SELECT * INTO p FROM profiles WHERE id = uid AND is_active = true;
  IF p IS NULL THEN RETURN false; END IF;
  
  SELECT * INTO inv FROM invoices WHERE id = inv_id;
  IF inv IS NULL THEN RETURN false; END IF;
  
  SELECT * INTO wf FROM invoice_workflows WHERE invoice_id = inv_id;
  
  -- Admin and operations see all
  IF p.role = 'admin' OR p.role = 'operations' THEN RETURN true; END IF;
  
  -- Viewer sees all (read-only)
  IF p.role = 'viewer' THEN RETURN true; END IF;
  
  -- Submitter sees own
  IF p.role = 'submitter' THEN
    RETURN inv.submitter_user_id = uid;
  END IF;
  
  -- Manager sees only assigned invoices
  IF p.role = 'manager' THEN
    RETURN wf.manager_user_id = uid;
  END IF;
  
  -- Finance sees payment-stage invoices
  IF p.role = 'finance' THEN
    RETURN wf.status IN ('ready_for_payment', 'paid', 'archived');
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Invoice files: manager sees only when assigned
DROP POLICY IF EXISTS "invoice_files_select_via_invoice" ON invoice_files;
CREATE POLICY "invoice_files_select_via_invoice" ON invoice_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN invoice_workflows iw ON iw.invoice_id = i.id
      JOIN profiles p ON p.id = auth.uid() AND p.is_active = true
      WHERE i.id = invoice_files.invoice_id
        AND (
          p.role = 'admin'
          OR p.role = 'operations'
          OR p.role = 'viewer'
          OR i.submitter_user_id = auth.uid()
          OR iw.manager_user_id = auth.uid()
          OR (p.role = 'finance' AND iw.status IN ('ready_for_payment','paid','archived'))
          OR EXISTS (SELECT 1 FROM operations_room_members o WHERE o.user_id = auth.uid())
        )
    )
  );
