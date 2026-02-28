-- Per-user contractor preference list: each person saves who they prefer to work with.
-- AI suggest prefers people who appear in more users' lists (when available).
CREATE TABLE IF NOT EXISTS contractor_preference_per_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  preferred_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, preferred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_contractor_pref_user ON contractor_preference_per_user(user_id);
CREATE INDEX IF NOT EXISTS idx_contractor_pref_preferred ON contractor_preference_per_user(preferred_user_id);

ALTER TABLE contractor_preference_per_user ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON contractor_preference_per_user FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
