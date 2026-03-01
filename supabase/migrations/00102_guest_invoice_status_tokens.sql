-- Guest invoice status tokens: allow guests to check invoice status and download after submission.
-- Created when guest submits (upload or generate); token returned in success response.
CREATE TABLE IF NOT EXISTS guest_invoice_status_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  guest_email text,
  guest_name text,
  program_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE guest_invoice_status_tokens IS 'Tokens for guests to check invoice status and download after submission.';

CREATE INDEX IF NOT EXISTS idx_guest_invoice_status_tokens_token ON guest_invoice_status_tokens(token);

ALTER TABLE guest_invoice_status_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_invoice_status_tokens_no_public"
  ON guest_invoice_status_tokens FOR ALL
  USING (false)
  WITH CHECK (false);
