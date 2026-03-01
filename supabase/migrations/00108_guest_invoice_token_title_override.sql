-- Add title override to guest invoice submit tokens (from producer's link).
ALTER TABLE guest_invoice_submit_tokens ADD COLUMN IF NOT EXISTS title text;
COMMENT ON COLUMN guest_invoice_submit_tokens.title IS 'Override: guest title for this specific link';
