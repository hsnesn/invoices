-- Add primary_program for search: match guest's program with search query
ALTER TABLE guest_contacts
  ADD COLUMN IF NOT EXISTS primary_program text DEFAULT NULL;

COMMENT ON COLUMN guest_contacts.primary_program IS 'Primary program guest appears on (for search matching)';

-- Extend search_vector to include primary_program (person's program matches search)
ALTER TABLE guest_contacts DROP COLUMN IF EXISTS search_vector;
ALTER TABLE guest_contacts
  ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(guest_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(coalesce(title_category, ''), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(topic, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(coalesce(topic_category, ''), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(primary_program, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(email, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_guest_contacts_search ON guest_contacts USING GIN(search_vector);

CREATE OR REPLACE FUNCTION search_guest_contacts(search_query text)
RETURNS SETOF guest_contacts
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM guest_contacts
  WHERE search_query IS NULL OR search_query = '' OR search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY guest_name;
$$;
