-- Full-text search and conflict of interest for guest contacts

-- Search vector: guest_name, title, topic, email for fast search
ALTER TABLE guest_contacts
  ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(guest_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(coalesce(title_category, ''), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(topic, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(coalesce(topic_category, ''), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(email, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_guest_contacts_search ON guest_contacts USING GIN(search_vector);

-- RPC for full-text search (used when search term provided)
CREATE OR REPLACE FUNCTION search_guest_contacts(search_query text)
RETURNS SETOF guest_contacts
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM guest_contacts
  WHERE search_query IS NULL OR search_query = '' OR search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY guest_name;
$$;

-- Conflict of interest and enrichment
ALTER TABLE guest_contacts
  ADD COLUMN IF NOT EXISTS affiliated_orgs text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS prohibited_topics text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conflict_of_interest_notes text DEFAULT NULL;

COMMENT ON COLUMN guest_contacts.affiliated_orgs IS 'Organizations the guest is affiliated with (for conflict checks)';
COMMENT ON COLUMN guest_contacts.prohibited_topics IS 'Topics this guest should not comment on';
COMMENT ON COLUMN guest_contacts.conflict_of_interest_notes IS 'Free-form conflict of interest notes';
