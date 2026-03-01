-- Bank transfer form tracking on invoices.
-- Used for international (IBAN/SWIFT) transfer forms only.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_transfer_form_path text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_transfer_form_status text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_transfer_generated_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_transfer_generated_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_transfer_currency text;

CREATE INDEX IF NOT EXISTS idx_invoices_bank_transfer_form_path ON invoices(bank_transfer_form_path) WHERE bank_transfer_form_path IS NOT NULL;
