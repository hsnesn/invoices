-- Add optional invoice reference to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_messages_invoice ON messages(invoice_id) WHERE invoice_id IS NOT NULL;
