-- Add department, program, role to contractor preferences (optional scope).
-- When null, preference applies to all contexts.
ALTER TABLE contractor_preference_per_user
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES programs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role text;

-- Drop old unique, add new one that handles nulls (COALESCE for uniqueness)
ALTER TABLE contractor_preference_per_user DROP CONSTRAINT IF EXISTS contractor_preference_per_user_user_id_preferred_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contractor_pref_unique
  ON contractor_preference_per_user (
    user_id,
    preferred_user_id,
    COALESCE(department_id::text, ''),
    COALESCE(program_id::text, ''),
    COALESCE(role, '')
  );
