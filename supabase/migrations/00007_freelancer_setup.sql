-- Generic lookup table for freelancer-specific dropdown options
CREATE TABLE IF NOT EXISTS freelancer_setup_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,  -- 'service_description' | 'additional_cost_reason' | 'department_2' | 'istanbul_team'
  value text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fsi_category ON freelancer_setup_items(category);

ALTER TABLE freelancer_setup_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access freelancer setup"
  ON freelancer_setup_items FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed service descriptions from screenshots
INSERT INTO freelancer_setup_items (category, value, sort_order) VALUES
  ('service_description', 'Audio Production Services', 1),
  ('service_description', 'Broadcast Technical Services', 2),
  ('service_description', 'Camera & Editing Services', 3),
  ('service_description', 'Camera & Filming Services', 4),
  ('service_description', 'Editorial Production Services', 5),
  ('service_description', 'Output Support Services', 6),
  ('service_description', 'Presentation Services', 7);

-- Seed booked by people from screenshots
INSERT INTO freelancer_setup_items (category, value, sort_order) VALUES
  ('booked_by', 'Hasan ESEN', 1),
  ('booked_by', 'Kubra SELVI', 2),
  ('booked_by', 'Mehmet Ali MAYBASKAN', 3),
  ('booked_by', 'Alice TEGG', 4),
  ('booked_by', 'Ahmet SEÇKİN', 5),
  ('booked_by', 'Tarik ZARROUG', 6),
  ('booked_by', 'Zeyney ERYILMAZ', 7);

-- Seed department 2 options
INSERT INTO freelancer_setup_items (category, value, sort_order) VALUES
  ('department_2', 'Istanbul Team', 1);

-- Seed istanbul team options
INSERT INTO freelancer_setup_items (category, value, sort_order) VALUES
  ('istanbul_team', 'Istanbul Team', 1);
