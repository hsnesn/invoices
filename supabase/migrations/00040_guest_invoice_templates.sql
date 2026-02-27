-- Producer-specific guest invoice templates (drafts)
-- Producers can save and reuse guest/bank details when generating invoices
CREATE TABLE IF NOT EXISTS guest_invoice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  guest_name text,
  guest_address text,
  guest_phone text,
  guest_email text,
  account_name text,
  bank_name text,
  account_number text,
  sort_code text,
  bank_address text,
  paypal text,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  program_id uuid REFERENCES programs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_invoice_templates_creator ON guest_invoice_templates(creator_user_id);

ALTER TABLE guest_invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own guest invoice templates"
  ON guest_invoice_templates FOR ALL
  USING (auth.uid() = creator_user_id)
  WITH CHECK (auth.uid() = creator_user_id);
