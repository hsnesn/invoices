-- Add invoice_type to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS invoice_type text NOT NULL DEFAULT 'guest';

COMMENT ON COLUMN invoices.invoice_type IS 'guest | freelancer | salary';

CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);

-- Freelancer-specific fields stored separately
CREATE TABLE IF NOT EXISTS freelancer_invoice_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  contractor_name text,
  company_name text,
  service_description text,
  service_days_count integer,
  service_days text,
  service_rate_per_day numeric(12,2),
  service_month text,
  additional_cost numeric(12,2) DEFAULT 0,
  additional_cost_reason text,
  booked_by text,
  department_2 text,
  istanbul_team text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_id)
);

ALTER TABLE freelancer_invoice_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access freelancer fields"
  ON freelancer_invoice_fields FOR ALL
  USING (true)
  WITH CHECK (true);
