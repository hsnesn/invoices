-- Guest invoice submit tokens: secure links for guests to submit invoice without login.
-- Token is created when post-recording email is sent; guest clicks link to upload invoice.
CREATE TABLE IF NOT EXISTS guest_invoice_submit_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_guest_id uuid NOT NULL REFERENCES producer_guests(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

COMMENT ON TABLE guest_invoice_submit_tokens IS 'Tokens for guest invoice submission links. Sent in post-recording emails.';

CREATE INDEX IF NOT EXISTS idx_guest_invoice_submit_tokens_token ON guest_invoice_submit_tokens(token) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guest_invoice_submit_tokens_guest ON guest_invoice_submit_tokens(producer_guest_id);

ALTER TABLE guest_invoice_submit_tokens ENABLE ROW LEVEL SECURITY;

-- No direct access via anon/authenticated; API uses service_role (bypasses RLS)
CREATE POLICY "guest_invoice_submit_tokens_no_public"
  ON guest_invoice_submit_tokens FOR ALL
  USING (false)
  WITH CHECK (false);
