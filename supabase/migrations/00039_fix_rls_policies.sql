-- Fix RLS policies: replace USING(true) with proper admin/operations role checks.
-- Affects: employees, salaries, freelancer_invoice_fields

-- employees: drop overly permissive policy, add proper role-based policies
DROP POLICY IF EXISTS "Admin full access employees" ON employees;

CREATE POLICY "employees_admin_ops_all" ON employees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'operations')
        AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'operations')
        AND is_active = true
    )
  );

-- salaries: drop overly permissive policy, add proper role-based policies
DROP POLICY IF EXISTS "Admin full access salaries" ON salaries;

CREATE POLICY "salaries_admin_ops_all" ON salaries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'operations')
        AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'operations')
        AND is_active = true
    )
  );

-- freelancer_invoice_fields: drop overly permissive policy, add proper role-based policies
DROP POLICY IF EXISTS "Admin full access freelancer fields" ON freelancer_invoice_fields;

CREATE POLICY "freelancer_fields_authenticated_select" ON freelancer_invoice_fields
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "freelancer_fields_admin_ops_modify" ON freelancer_invoice_fields
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'operations', 'manager', 'submitter')
        AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'operations', 'manager', 'submitter')
        AND is_active = true
    )
  );
