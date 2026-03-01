-- Add international bank transfer fields to guest_invoice_templates
ALTER TABLE guest_invoice_templates
  ADD COLUMN IF NOT EXISTS bank_type text DEFAULT 'uk',
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS swift_bic text;

COMMENT ON COLUMN guest_invoice_templates.bank_type IS 'uk or international';
COMMENT ON COLUMN guest_invoice_templates.iban IS 'IBAN for international transfers';
COMMENT ON COLUMN guest_invoice_templates.swift_bic IS 'SWIFT/BIC for international transfers';
