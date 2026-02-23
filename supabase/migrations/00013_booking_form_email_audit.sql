-- Idempotency and audit log for Booking Form email workflow
-- Triggered when Line Manager approves a freelancer invoice

CREATE TABLE IF NOT EXISTS booking_form_email_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL REFERENCES profiles(id),
  approved_at timestamptz NOT NULL,
  idempotency_key text NOT NULL,
  email_a_sent_at timestamptz,
  email_b_sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  errors text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(idempotency_key)
);

COMMENT ON TABLE booking_form_email_audit IS 'Audit log for Booking Form PDF + Email A/B workflow on freelancer approval';
COMMENT ON COLUMN booking_form_email_audit.idempotency_key IS 'invoice_id + approved_at ISO string to prevent duplicate sends';
COMMENT ON COLUMN booking_form_email_audit.status IS 'pending | completed | failed';

CREATE INDEX IF NOT EXISTS idx_booking_form_audit_invoice ON booking_form_email_audit(invoice_id);
CREATE INDEX IF NOT EXISTS idx_booking_form_audit_approved_at ON booking_form_email_audit(approved_at);
