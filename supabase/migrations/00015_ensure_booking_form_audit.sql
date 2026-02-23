-- Ensure booking_form_email_audit exists (in case 00013 was not applied)
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

CREATE INDEX IF NOT EXISTS idx_booking_form_audit_invoice ON booking_form_email_audit(invoice_id);
CREATE INDEX IF NOT EXISTS idx_booking_form_audit_approved_at ON booking_form_email_audit(approved_at);
