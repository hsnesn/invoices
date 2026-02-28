-- Output Schedule: availability, assignments, door log, settings

-- Availability: freelancers mark which days they're available
CREATE TABLE IF NOT EXISTS output_schedule_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_output_avail_user ON output_schedule_availability(user_id);
CREATE INDEX IF NOT EXISTS idx_output_avail_date ON output_schedule_availability(date);

-- Assignments: who is assigned to which day (after AI or manual)
CREATE TYPE output_assignment_status AS ENUM ('pending', 'confirmed', 'attended', 'no_show');

CREATE TABLE IF NOT EXISTS output_schedule_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  status output_assignment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_output_assign_user ON output_schedule_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_output_assign_date ON output_schedule_assignments(date);

-- Door log: raw entries from import, optionally matched to user
CREATE TABLE IF NOT EXISTS output_schedule_door_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  time time,
  raw_identifier text NOT NULL,
  matched_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'import' CHECK (source IN ('import', 'manual')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_output_door_date ON output_schedule_door_log(date);
CREATE INDEX IF NOT EXISTS idx_output_door_matched ON output_schedule_door_log(matched_user_id);

-- Settings via app_settings
INSERT INTO app_settings (key, value) VALUES
  ('output_schedule_people_per_day', '3'::jsonb),
  ('output_schedule_weekly_report_recipients', '[]'::jsonb),
  ('output_schedule_manual_match_allowed', '"admin,operations"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE output_schedule_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE output_schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE output_schedule_door_log ENABLE ROW LEVEL SECURITY;

-- Availability: users can CRUD own; admin/operations see all
CREATE POLICY "output_avail_select_own" ON output_schedule_availability FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations') AND is_active));

CREATE POLICY "output_avail_insert_own" ON output_schedule_availability FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "output_avail_delete_own" ON output_schedule_availability FOR DELETE
  USING (user_id = auth.uid());

-- Assignments: admin/operations full; others see own
CREATE POLICY "output_assign_select" ON output_schedule_assignments FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations') AND is_active));

CREATE POLICY "output_assign_all_admin" ON output_schedule_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations') AND is_active))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations') AND is_active));

-- Door log: admin/operations only
CREATE POLICY "output_door_admin" ON output_schedule_door_log FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations') AND is_active))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations') AND is_active));
