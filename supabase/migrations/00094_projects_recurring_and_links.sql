-- Projects, recurring invoices, office request enhancements (vendor, invoice link, attachments)

-- Projects table
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled')),
  deadline date,
  assignee_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_deadline ON projects(deadline);
CREATE INDEX idx_projects_assignee ON projects(assignee_user_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select" ON projects FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "projects_insert" ON projects FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND role IN ('admin', 'operations', 'manager'))
  );

CREATE POLICY "projects_update" ON projects FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND role IN ('admin', 'operations', 'manager'))
  );

CREATE POLICY "projects_delete" ON projects FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND role IN ('admin', 'operations'))
  );

-- Add project_id to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);

-- Add project_id, vendor_id, linked_invoice_id to office_requests
ALTER TABLE office_requests ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE office_requests ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL;
ALTER TABLE office_requests ADD COLUMN IF NOT EXISTS linked_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_office_requests_project ON office_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_office_requests_vendor ON office_requests(vendor_id);

-- Recurring invoices
CREATE TABLE recurring_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  beneficiary_name text,
  amount numeric,
  currency text DEFAULT 'GBP',
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_due_date date NOT NULL,
  last_reminder_sent_at timestamptz,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_recurring_invoices_next_due ON recurring_invoices(next_due_date) WHERE is_active = true;

ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_invoices_select" ON recurring_invoices FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "recurring_invoices_insert" ON recurring_invoices FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND role IN ('admin', 'finance', 'operations'))
  );

CREATE POLICY "recurring_invoices_update" ON recurring_invoices FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND role IN ('admin', 'finance', 'operations'))
  );

CREATE POLICY "recurring_invoices_delete" ON recurring_invoices FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND role IN ('admin', 'finance', 'operations'))
  );

-- Office request attachments (storage bucket created separately if needed)
CREATE TABLE office_request_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_request_id uuid NOT NULL REFERENCES office_requests(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_office_request_attachments_request ON office_request_attachments(office_request_id);

ALTER TABLE office_request_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office_request_attachments_select" ON office_request_attachments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM office_requests o JOIN profiles p ON p.id = auth.uid() AND p.is_active = true
      WHERE o.id = office_request_attachments.office_request_id
        AND (o.requester_user_id = auth.uid() OR p.role IN ('admin', 'operations')))
  );

CREATE POLICY "office_request_attachments_insert" ON office_request_attachments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM office_requests o JOIN profiles p ON p.id = auth.uid() AND p.is_active = true
      WHERE o.id = office_request_attachments.office_request_id
        AND (o.requester_user_id = auth.uid() OR p.role IN ('admin', 'operations')))
  );

CREATE POLICY "office_request_attachments_delete" ON office_request_attachments FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM office_requests o JOIN profiles p ON p.id = auth.uid() AND p.is_active = true
      WHERE o.id = office_request_attachments.office_request_id
        AND (o.requester_user_id = auth.uid() OR p.role IN ('admin', 'operations')))
  );

-- Storage bucket for office request attachments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'office-request-attachments') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'office-request-attachments',
      'office-request-attachments',
      false,
      10485760,
      ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
    );
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
