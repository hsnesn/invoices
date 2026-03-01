-- Track guest invoice link sends per producer per day (max 5/day).
CREATE TABLE IF NOT EXISTS guest_invoice_link_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_invoice_link_sends_producer_day
  ON guest_invoice_link_sends (producer_user_id, created_at);

COMMENT ON TABLE guest_invoice_link_sends IS 'Tracks invoice link sends per producer for daily limit (5/day).';

ALTER TABLE guest_invoice_link_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_invoice_link_sends_no_public"
  ON guest_invoice_link_sends FOR ALL
  USING (false)
  WITH CHECK (false);
