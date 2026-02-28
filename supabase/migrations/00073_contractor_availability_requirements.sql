-- Daily requirements: how many people per role per day (set by admin/operations/manager)

CREATE TABLE IF NOT EXISTS contractor_availability_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  role text NOT NULL,
  count_needed integer NOT NULL DEFAULT 1 CHECK (count_needed >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(date, role)
);

CREATE INDEX IF NOT EXISTS idx_car_date ON contractor_availability_requirements(date);

ALTER TABLE contractor_availability_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "car_admin_ops_manager" ON contractor_availability_requirements FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations','manager') AND is_active))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations','manager') AND is_active));
