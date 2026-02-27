-- Per-user theme preference (light/dark)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_theme text DEFAULT NULL;
COMMENT ON COLUMN profiles.preferred_theme IS 'User theme: light, dark, or null (system/default)';
