-- Invoice Approval Workflow - Initial Schema
-- Run with Supabase migration tool

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE app_role AS ENUM ('submitter', 'manager', 'admin', 'finance');

CREATE TYPE invoice_status AS ENUM (
  'submitted',
  'pending_manager',
  'rejected',
  'approved_by_manager',
  'pending_admin',
  'ready_for_payment',
  'paid',
  'archived'
);

-- Departments
CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Programs (dependent on department)
CREATE TABLE programs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role app_role NOT NULL DEFAULT 'submitter',
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  program_ids uuid[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User invitations
CREATE TABLE user_invitations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  full_name text,
  role app_role NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  program_ids uuid[] DEFAULT '{}',
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_at timestamptz DEFAULT now(),
  accepted boolean DEFAULT false,
  accepted_at timestamptz,
  UNIQUE(email)
);

-- Invoices
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  submitter_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  program_id uuid REFERENCES programs(id) ON DELETE SET NULL,
  service_description text,
  service_date_from date,
  service_date_to date,
  currency text DEFAULT 'GBP',
  storage_path text,
  previous_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Invoice workflows (one per invoice)
CREATE TABLE invoice_workflows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE CASCADE,
  status invoice_status NOT NULL DEFAULT 'submitted',
  manager_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rejection_reason text,
  payment_reference text,
  paid_date date,
  admin_comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Invoice extracted fields (AI extraction)
CREATE TABLE invoice_extracted_fields (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE CASCADE,
  beneficiary_name text,
  account_number text,
  sort_code text,
  invoice_number text,
  invoice_date date,
  net_amount numeric,
  vat_amount numeric,
  gross_amount numeric,
  extracted_currency text,
  needs_review boolean DEFAULT true,
  manager_confirmed boolean DEFAULT false,
  raw_json jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Audit events (immutable)
CREATE TABLE audit_events (
  id bigserial PRIMARY KEY,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  payload jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);
CREATE INDEX idx_profiles_department ON profiles(department_id);
CREATE INDEX idx_invoices_submitter ON invoices(submitter_user_id);
CREATE INDEX idx_invoices_department ON invoices(department_id);
CREATE INDEX idx_invoices_program ON invoices(program_id);
CREATE INDEX idx_invoice_workflows_status ON invoice_workflows(status);
CREATE INDEX idx_invoice_workflows_manager ON invoice_workflows(manager_user_id);
CREATE INDEX idx_audit_events_invoice ON audit_events(invoice_id);
CREATE INDEX idx_audit_events_actor ON audit_events(actor_user_id);
CREATE INDEX idx_audit_events_created ON audit_events(created_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
CREATE TRIGGER invoice_workflows_updated_at BEFORE UPDATE ON invoice_workflows
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
CREATE TRIGGER invoice_extracted_fields_updated_at BEFORE UPDATE ON invoice_extracted_fields
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
