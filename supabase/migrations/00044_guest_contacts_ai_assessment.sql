-- Persist AI assessment so we don't re-evaluate
ALTER TABLE guest_contacts
  ADD COLUMN IF NOT EXISTS ai_assessment text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_assessed_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN guest_contacts.ai_assessment IS 'AI-generated guest assessment from invoice/appearance data';
COMMENT ON COLUMN guest_contacts.ai_assessed_at IS 'When AI assessment was last generated';
