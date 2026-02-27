-- Favorites and tags for guest contacts
ALTER TABLE guest_contacts
  ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_guest_contacts_favorite ON guest_contacts(is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_guest_contacts_tags ON guest_contacts USING GIN(tags);
