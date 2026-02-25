-- Contractor/beneficiary templates: when a name matches, auto-fill bank details
CREATE TABLE IF NOT EXISTS contractor_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_aliases text[] DEFAULT '{}',
  account_number text,
  sort_code text,
  beneficiary_name text,
  company_name text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contractor_templates_sort ON contractor_templates(sort_order);

ALTER TABLE contractor_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access contractor templates"
  ON contractor_templates FOR ALL
  USING (true)
  WITH CHECK (true);
