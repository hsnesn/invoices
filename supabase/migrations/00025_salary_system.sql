-- Salary Processing System
-- Employees master database and salary records

-- Employee master database
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  ni_number text,
  bank_account_number text,
  sort_code text,
  email_address text,
  badge_color text,
  default_payment_method text DEFAULT 'bank_transfer',
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'left')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_full_name ON employees(full_name);
CREATE INDEX IF NOT EXISTS idx_employees_ni_number ON employees(ni_number);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- Salary records (one row per employee per month)
CREATE TABLE IF NOT EXISTS salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id integer,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  employee_name text NOT NULL,
  ni_number text,
  bank_account_number text,
  sort_code text,
  net_pay numeric(12,2),
  total_gross_pay numeric(12,2),
  paye_tax numeric(12,2),
  employee_ni numeric(12,2),
  employee_pension numeric(12,2),
  employer_pension numeric(12,2),
  employer_ni numeric(12,2),
  employer_total_cost numeric(12,2),
  payment_month text,
  payment_year integer,
  process_date date,
  tax_period text,
  reference text,
  payslip_storage_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'needs_review', 'paid')),
  paid_date date,
  email_sent_status text DEFAULT 'not_sent' CHECK (email_sent_status IN ('not_sent', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sequence for display_id (auto-incrementing ID for display)
CREATE SEQUENCE IF NOT EXISTS salaries_display_id_seq;

CREATE OR REPLACE FUNCTION set_salary_display_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_id IS NULL THEN
    NEW.display_id := nextval('salaries_display_id_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS salaries_set_display_id ON salaries;
CREATE TRIGGER salaries_set_display_id
  BEFORE INSERT ON salaries
  FOR EACH ROW
  EXECUTE FUNCTION set_salary_display_id();

CREATE INDEX IF NOT EXISTS idx_salaries_employee_id ON salaries(employee_id);
CREATE INDEX IF NOT EXISTS idx_salaries_status ON salaries(status);
CREATE INDEX IF NOT EXISTS idx_salaries_payment_month ON salaries(payment_month);
CREATE INDEX IF NOT EXISTS idx_salaries_payment_year ON salaries(payment_year);
CREATE INDEX IF NOT EXISTS idx_salaries_process_date ON salaries(process_date);
CREATE INDEX IF NOT EXISTS idx_salaries_created_at ON salaries(created_at);

-- Salary audit events (extend audit_events with salary_id)
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS salary_id uuid REFERENCES salaries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_salary ON audit_events(salary_id);

-- Storage bucket for payslips (use existing invoices bucket or document it)
-- Payslips stored under: salaries/{user_id}/{salary_id}-{filename}

-- RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;

-- Admin and operations can manage employees and salaries
CREATE POLICY "Admin full access employees"
  ON employees FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin full access salaries"
  ON salaries FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE employees IS 'Employee master database for salary payment matching';
COMMENT ON TABLE salaries IS 'Salary records - one per employee per month, AI-extracted from payslips';
