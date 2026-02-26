-- Store generated guest invoice structure (appearances, expenses, paypal)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS generated_invoice_data jsonb DEFAULT NULL;

COMMENT ON COLUMN invoices.generated_invoice_data IS 'For guest invoices generated via form: { appearances: [{ topic, date, amount }], expenses: [{ label, amount }], paypal?: string }';
