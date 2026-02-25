-- Add Operations role: sees all invoices, can only approve/reject in The Operations Room (freelancer, pending_admin)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'operations';

-- Update can_see_invoice: operations sees all (like admin)
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
  
  -- Manager sees assigned or in scope
  IF p.role = 'manager' THEN
    RETURN (wf.manager_user_id = uid)
       OR (inv.program_id = ANY(COALESCE(p.program_ids, ARRAY[]::uuid[])))
       OR (inv.department_id = p.department_id);
  END IF;
  
  -- Finance sees payment-stage invoices
  IF p.role = 'finance' THEN
    RETURN wf.status IN ('ready_for_payment', 'paid', 'archived');
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Operations can update invoice_workflows only when status is pending_admin (freelancer) - for approve/reject
-- Note: Status API uses service role; this policy covers direct DB access
CREATE POLICY "workflows_operations_update" ON invoice_workflows FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN invoices i ON i.id = invoice_workflows.invoice_id
      WHERE p.id = auth.uid() AND p.role = 'operations' AND p.is_active = true
        AND i.invoice_type = 'freelancer'
        AND invoice_workflows.status IN ('approved_by_manager', 'pending_admin')
    )
  );

-- Invoice files: operations can read all invoices
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
          OR i.submitter_user_id = auth.uid()
          OR iw.manager_user_id = auth.uid()
          OR (p.role = 'manager' AND p.department_id = i.department_id)
          OR (p.role = 'manager' AND i.program_id IS NOT NULL AND p.program_ids @> ARRAY[i.program_id])
          OR (p.role = 'finance' AND iw.status IN ('ready_for_payment','paid','archived'))
          OR EXISTS (SELECT 1 FROM operations_room_members o WHERE o.user_id = auth.uid())
        )
    )
  );
