-- Post-recording details when producer marks guest as accepted
ALTER TABLE producer_guests
  ADD COLUMN IF NOT EXISTS payment_received boolean,
  ADD COLUMN IF NOT EXISTS payment_amount numeric,
  ADD COLUMN IF NOT EXISTS payment_currency text,
  ADD COLUMN IF NOT EXISTS recording_date date,
  ADD COLUMN IF NOT EXISTS recording_topic text;

COMMENT ON COLUMN producer_guests.payment_received IS 'Whether guest receives payment for this appearance';
COMMENT ON COLUMN producer_guests.payment_amount IS 'Amount guest will receive (when payment_received=true)';
COMMENT ON COLUMN producer_guests.payment_currency IS 'Currency (GBP/EUR/USD)';
COMMENT ON COLUMN producer_guests.recording_date IS 'Date when program was recorded';
COMMENT ON COLUMN producer_guests.recording_topic IS 'Topic of the recorded program';
