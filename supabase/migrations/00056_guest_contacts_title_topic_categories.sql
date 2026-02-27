-- AI-categorized title and topic mappings for guest contacts
-- Raw values (e.g. "Journalist", "Political commentator") are mapped to standardized categories

CREATE TABLE IF NOT EXISTS title_category_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_title text NOT NULL UNIQUE,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS topic_category_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_topic text NOT NULL UNIQUE,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_title_category_raw ON title_category_mapping(raw_title);
CREATE INDEX IF NOT EXISTS idx_topic_category_raw ON topic_category_mapping(raw_topic);

-- Add category columns to guest_contacts (derived from title; topic is per-appearance, we store primary)
ALTER TABLE guest_contacts
  ADD COLUMN IF NOT EXISTS title_category text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS topic text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS topic_category text DEFAULT NULL;

COMMENT ON COLUMN guest_contacts.title_category IS 'AI-categorized title (e.g. Media, Political analyst)';
COMMENT ON COLUMN guest_contacts.topic IS 'Primary topic from most recent invoice appearance';
COMMENT ON COLUMN guest_contacts.topic_category IS 'AI-categorized topic';
