ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS allowed_pages text[] DEFAULT NULL;

COMMENT ON COLUMN profiles.allowed_pages IS
  'Which pages this user can access. NULL means all pages (default).';
