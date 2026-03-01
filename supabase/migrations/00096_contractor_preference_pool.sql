-- Contractor Preference Pool: users eligible to appear in "My Preference List" dropdown.
-- Admin manages this in Setup. When populated, only these users appear in the preference list.
-- When empty, all active users appear (backward compatible).
CREATE TABLE IF NOT EXISTS contractor_preference_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

COMMENT ON TABLE contractor_preference_pool IS 'Contractors eligible for My Preference List. Managed in Setup. When populated, only these users appear in the dropdown.';

CREATE INDEX IF NOT EXISTS idx_contractor_preference_pool_user ON contractor_preference_pool(user_id);

ALTER TABLE contractor_preference_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access contractor_preference_pool"
  ON contractor_preference_pool FOR ALL
  USING (true)
  WITH CHECK (true);
