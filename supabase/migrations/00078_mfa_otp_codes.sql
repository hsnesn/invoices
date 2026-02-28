-- MFA OTP codes for email-based verification
-- Codes expire after 10 minutes, rate limited by user

CREATE TABLE IF NOT EXISTS mfa_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfa_otp_user_expires ON mfa_otp_codes(user_id, expires_at);

-- RLS: only service role can access (API uses admin client)
ALTER TABLE mfa_otp_codes ENABLE ROW LEVEL SECURITY;

-- No policies: table is accessed only via service role in API routes
