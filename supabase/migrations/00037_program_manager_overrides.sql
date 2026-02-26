-- Program-specific Dept EP overrides.
-- When a program name contains the key (case-insensitive), use this manager instead of department/default.
-- Example: program_name_key='newsmaker' -> Newsmaker program uses the configured manager.

CREATE TABLE IF NOT EXISTS program_manager_overrides (
  program_name_key text PRIMARY KEY,
  manager_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE program_manager_overrides IS 'Override Dept EP per program. program_name_key matches program name (case-insensitive contains).';

ALTER TABLE program_manager_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_manager_overrides_admin_all" ON program_manager_overrides FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

-- Seed Newsmaker default: Simonetta FORNASIERO (if she exists)
INSERT INTO program_manager_overrides (program_name_key, manager_user_id)
SELECT 'newsmaker', id FROM profiles
WHERE full_name ILIKE '%Simonetta%Fornasiero%' AND role = 'manager' AND is_active = true
LIMIT 1
ON CONFLICT (program_name_key) DO NOTHING;
