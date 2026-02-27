-- Add tags column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Index for efficient tag filtering
CREATE INDEX IF NOT EXISTS idx_invoices_tags ON invoices USING gin(tags);
