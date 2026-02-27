-- Other/misc invoices: any type of invoice, AI extraction, simple paid flow
-- invoice_type = 'other' uses existing tables
-- No new tables; just ensure RLS and indexes support 'other' type

-- Add comment for clarity
COMMENT ON COLUMN invoices.invoice_type IS 'guest | freelancer | salary | other';
