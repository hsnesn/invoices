-- Recurring requirements: e.g. every Monday 2 Output
CREATE TABLE IF NOT EXISTS contractor_availability_recurring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  role text NOT NULL,
  count_needed integer NOT NULL DEFAULT 1 CHECK (count_needed >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(day_of_week, role)
);

CREATE INDEX IF NOT EXISTS idx_car_recurring_dow ON contractor_availability_recurring(day_of_week);
ALTER TABLE contractor_availability_recurring ENABLE ROW LEVEL SECURITY;
CREATE POLICY "car_recurring_admin_ops_manager" ON contractor_availability_recurring FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations','manager') AND is_active))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations','manager') AND is_active));

-- Unavailability (blackout): days contractor cannot work
CREATE TABLE IF NOT EXISTS output_schedule_unavailability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_unavail_user ON output_schedule_unavailability(user_id);
CREATE INDEX IF NOT EXISTS idx_unavail_date ON output_schedule_unavailability(date);
ALTER TABLE output_schedule_unavailability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unavail_select_own" ON output_schedule_unavailability FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations','manager') AND is_active));
CREATE POLICY "unavail_insert_own" ON output_schedule_unavailability FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "unavail_delete_own" ON output_schedule_unavailability FOR DELETE
  USING (user_id = auth.uid());

-- Notes on assignments
ALTER TABLE output_schedule_assignments
  ADD COLUMN IF NOT EXISTS notes text;

-- Shift times (optional)
ALTER TABLE output_schedule_assignments
  ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE output_schedule_assignments
  ADD COLUMN IF NOT EXISTS end_time time;

-- Audit log for contractor availability
CREATE TABLE IF NOT EXISTS contractor_availability_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_audit_created ON contractor_availability_audit(created_at);
ALTER TABLE contractor_availability_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca_audit_admin_ops_manager" ON contractor_availability_audit FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations','manager') AND is_active));
