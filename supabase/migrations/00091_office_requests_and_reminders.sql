-- Office requests: user submits request (e.g. chair needed), admin approves -> becomes to-do, completion sends email
-- Reminders: recurring maintenance (e.g. fire extinguisher inspection)

-- Request categories (configurable via app_settings or enum)
CREATE TYPE office_request_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'completed'
);

CREATE TYPE office_request_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

CREATE TABLE office_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  priority office_request_priority NOT NULL DEFAULT 'normal',
  status office_request_status NOT NULL DEFAULT 'pending',
  requester_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  rejection_reason text,
  cost_estimate numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE office_request_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_request_id uuid NOT NULL REFERENCES office_requests(id) ON DELETE CASCADE,
  assignee_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at timestamptz,
  completed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  completion_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(office_request_id)
);

CREATE INDEX idx_office_requests_status ON office_requests(status);
CREATE INDEX idx_office_requests_requester ON office_requests(requester_user_id);
CREATE INDEX idx_office_requests_created ON office_requests(created_at DESC);
CREATE INDEX idx_office_request_todos_assignee ON office_request_todos(assignee_user_id);
CREATE INDEX idx_office_request_todos_due ON office_request_todos(due_date);

-- Reminders: recurring maintenance (fire extinguisher, etc.)
CREATE TABLE reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  frequency_months int NOT NULL DEFAULT 6,
  next_due_date date NOT NULL,
  assignee_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notify_user_ids uuid[] DEFAULT '{}',
  last_notified_at timestamptz,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_reminders_next_due ON reminders(next_due_date) WHERE is_active = true;

-- RLS
ALTER TABLE office_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_request_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- office_requests: requester sees own; admin/operations see all; can approve
CREATE POLICY "office_requests_select_own" ON office_requests FOR SELECT
  TO authenticated USING (
    requester_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND role IN ('admin', 'operations'))
  );

CREATE POLICY "office_requests_insert_own" ON office_requests FOR INSERT
  TO authenticated WITH CHECK (
    requester_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "office_requests_update_admin" ON office_requests FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND role IN ('admin', 'operations'))
  );

-- office_request_todos: assignee sees assignee's; admin/operations see all
CREATE POLICY "office_request_todos_select" ON office_request_todos FOR SELECT
  TO authenticated USING (
    assignee_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND role IN ('admin', 'operations'))
  );

CREATE POLICY "office_request_todos_insert" ON office_request_todos FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND role IN ('admin', 'operations'))
  );

CREATE POLICY "office_request_todos_update" ON office_request_todos FOR UPDATE
  TO authenticated USING (
    assignee_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND role IN ('admin', 'operations'))
  );

-- reminders: admin/operations manage; assignee sees assigned
CREATE POLICY "reminders_select" ON reminders FOR SELECT
  TO authenticated USING (
    assignee_user_id = auth.uid()
    OR auth.uid() = ANY(notify_user_ids)
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND role IN ('admin', 'operations'))
  );

CREATE POLICY "reminders_insert" ON reminders FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND role IN ('admin', 'operations'))
  );

CREATE POLICY "reminders_update" ON reminders FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND role IN ('admin', 'operations'))
  );

-- Seed categories in app_settings (optional)
INSERT INTO app_settings (key, value)
VALUES ('office_request_categories', '["furniture","it_equipment","office_supplies","maintenance","software","training","other"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
