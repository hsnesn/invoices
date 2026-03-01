-- Allow token to override program when linking to existing producer_guest with multiple programs
ALTER TABLE guest_invoice_submit_tokens
  ADD COLUMN IF NOT EXISTS program_name text,
  ADD COLUMN IF NOT EXISTS recording_date text,
  ADD COLUMN IF NOT EXISTS recording_topic text,
  ADD COLUMN IF NOT EXISTS payment_amount numeric,
  ADD COLUMN IF NOT EXISTS payment_currency text;

COMMENT ON COLUMN guest_invoice_submit_tokens.program_name IS 'Override: program for this specific link when adding program to existing guest';
COMMENT ON COLUMN guest_invoice_submit_tokens.recording_date IS 'Override: recording date for this program';
COMMENT ON COLUMN guest_invoice_submit_tokens.recording_topic IS 'Override: recording topic for this program';
COMMENT ON COLUMN guest_invoice_submit_tokens.payment_amount IS 'Override: payment amount for this program';
COMMENT ON COLUMN guest_invoice_submit_tokens.payment_currency IS 'Override: payment currency for this program';
