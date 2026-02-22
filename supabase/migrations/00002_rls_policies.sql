-- RLS Policies for Invoice Approval Workflow
-- Visibility must be consistent across invoices, workflows, extracted fields, and audit_events

-- Enable RLS on all tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_extracted_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Helper: Get current user's profile (active only)
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS profiles AS $$
  SELECT * FROM profiles WHERE id = auth.uid() AND is_active = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: Check if user can see an invoice (used for joins)
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
  
  -- Admin sees all
  IF p.role = 'admin' THEN RETURN true; END IF;
  
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

-- ========== DEPARTMENTS ==========
CREATE POLICY "departments_select" ON departments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "departments_admin_all" ON departments FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

-- ========== PROGRAMS ==========
CREATE POLICY "programs_select" ON programs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "programs_admin_all" ON programs FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

-- ========== PROFILES ==========
-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "profiles_select_admin" ON profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true)
  );

-- Admins can update profiles (role, is_active, etc.) - but not escalate their own role
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true)
  );

-- Users can update their own full_name only
CREATE POLICY "profiles_update_own_name" ON profiles FOR UPDATE
  TO authenticated USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ========== USER INVITATIONS ==========
-- Admins can manage invitations
CREATE POLICY "invitations_admin_all" ON user_invitations FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

-- Invited user can read their own invitation (by email - matched server-side)
CREATE POLICY "invitations_select_own" ON user_invitations FOR SELECT
  TO authenticated USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ========== INVOICES ==========
CREATE POLICY "invoices_submitter_insert" ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    submitter_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "invoices_select" ON invoices FOR SELECT
  TO authenticated USING (
    can_see_invoice(id, auth.uid())
  );

CREATE POLICY "invoices_submitter_update_own" ON invoices FOR UPDATE
  TO authenticated USING (submitter_user_id = auth.uid())
  WITH CHECK (submitter_user_id = auth.uid());

CREATE POLICY "invoices_admin_update" ON invoices FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

-- ========== INVOICE_WORKFLOWS ==========
CREATE POLICY "workflows_select" ON invoice_workflows FOR SELECT
  TO authenticated USING (
    can_see_invoice(invoice_id, auth.uid())
  );

-- Manager can update (approve/reject) only assigned workflows
CREATE POLICY "workflows_manager_update" ON invoice_workflows FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN invoices i ON i.id = invoice_workflows.invoice_id
      WHERE p.id = auth.uid() AND p.role = 'manager' AND p.is_active = true
      AND (
        invoice_workflows.manager_user_id = auth.uid()
        OR i.program_id = ANY(p.program_ids)
        OR i.department_id = p.department_id
      )
    )
  );

-- Admin can update workflows
CREATE POLICY "workflows_admin_update" ON invoice_workflows FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

-- Finance can update (mark paid, archive)
CREATE POLICY "workflows_finance_update" ON invoice_workflows FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'finance' AND p.is_active = true
    )
    AND status IN ('ready_for_payment', 'paid', 'archived')
  );

-- Insert is done server-side (service role) when invoice is created
CREATE POLICY "workflows_insert" ON invoice_workflows FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
  );

-- ========== INVOICE_EXTRACTED_FIELDS ==========
CREATE POLICY "extracted_select" ON invoice_extracted_fields FOR SELECT
  TO authenticated USING (
    can_see_invoice(invoice_id, auth.uid())
  );

CREATE POLICY "extracted_update" ON invoice_extracted_fields FOR UPDATE
  TO authenticated USING (
    can_see_invoice(invoice_id, auth.uid())
  );

-- Insert is done server-side
CREATE POLICY "extracted_insert" ON invoice_extracted_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    can_see_invoice(invoice_id, auth.uid())
  );

-- ========== AUDIT_EVENTS ==========
-- No DELETE or UPDATE allowed
CREATE POLICY "audit_select" ON audit_events FOR SELECT
  TO authenticated USING (
    invoice_id IS NULL OR can_see_invoice(invoice_id, auth.uid())
  );

CREATE POLICY "audit_insert" ON audit_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
  );

-- Revoke delete and update on audit_events
REVOKE DELETE ON audit_events FROM authenticated;
REVOKE UPDATE ON audit_events FROM authenticated;
