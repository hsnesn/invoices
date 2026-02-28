-- Index for producer-scoped invitation lookups
CREATE INDEX IF NOT EXISTS idx_guest_invitations_producer ON guest_invitations(producer_user_id) WHERE producer_user_id IS NOT NULL;
