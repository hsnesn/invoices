-- Department managers: assign manager(s) per department without code changes.
-- When invoice is submitted, manager is picked from this table first.

CREATE TABLE department_managers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  manager_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(department_id, manager_user_id)
);

CREATE INDEX idx_department_managers_dept ON department_managers(department_id);

ALTER TABLE department_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "department_managers_admin_all" ON department_managers FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );
