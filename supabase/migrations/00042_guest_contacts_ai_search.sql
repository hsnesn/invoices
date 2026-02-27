-- AI-found contact info from web search (with warning label)
ALTER TABLE guest_contacts
  ADD COLUMN IF NOT EXISTS ai_contact_info jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_searched_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN guest_contacts.ai_contact_info IS 'AI-extracted from web: { phone?, email?, social_media?: string[] }';
COMMENT ON COLUMN guest_contacts.ai_searched_at IS 'When AI web search was last run';
