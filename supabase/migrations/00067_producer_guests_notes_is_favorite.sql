-- Ensure producer_guests has notes and is_favorite (in case 00064 was not applied)
ALTER TABLE producer_guests
  ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;

COMMENT ON COLUMN producer_guests.notes IS 'Private notes about this guest (e.g. preferences, topics)';
COMMENT ON COLUMN producer_guests.is_favorite IS 'Producer marked this guest as favorite for quick access';

CREATE INDEX IF NOT EXISTS idx_producer_guests_favorite ON producer_guests(producer_user_id, is_favorite) WHERE is_favorite = true;
