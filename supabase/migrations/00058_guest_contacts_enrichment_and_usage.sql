-- LinkedIn/web enrichment: organization, bio, photo
ALTER TABLE guest_contacts
  ADD COLUMN IF NOT EXISTS organization text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bio text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS photo_url text DEFAULT NULL;

COMMENT ON COLUMN guest_contacts.organization IS 'Organization/company from LinkedIn or web enrichment';
COMMENT ON COLUMN guest_contacts.bio IS 'Short bio from LinkedIn or web enrichment';
COMMENT ON COLUMN guest_contacts.photo_url IS 'Profile photo URL from LinkedIn or web enrichment';

-- Usage history: computed from invoices at runtime (appearance_count, last_used_at in merged view)
