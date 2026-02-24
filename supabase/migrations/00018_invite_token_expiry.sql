-- Add invite_token and token_expires_at for multi-use invite links
-- Link valid until: accepted OR 24h expiry
ALTER TABLE user_invitations
  ADD COLUMN IF NOT EXISTS invite_token uuid,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

-- Backfill: generate tokens for existing pending invitations
UPDATE user_invitations
SET invite_token = gen_random_uuid(),
    token_expires_at = invited_at + interval '24 hours'
WHERE accepted = false AND invite_token IS NULL;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_user_invitations_invite_token
  ON user_invitations(invite_token) WHERE invite_token IS NOT NULL;
