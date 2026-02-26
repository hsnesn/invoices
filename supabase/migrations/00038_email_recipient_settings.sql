-- Per-stage recipient toggles: which recipient types get the email.
-- recipient_type: submitter, dept_ep, admin, finance, operations, producers
-- When unchecked, that recipient type is excluded from the email.

CREATE TABLE IF NOT EXISTS email_recipient_settings (
  stage_key text NOT NULL,
  recipient_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (stage_key, recipient_type)
);

COMMENT ON TABLE email_recipient_settings IS 'Per-stage: which recipient types receive the email. Unchecked = excluded.';

ALTER TABLE email_recipient_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_recipient_settings_admin_all" ON email_recipient_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true));

-- Seed defaults: all enabled
INSERT INTO email_recipient_settings (stage_key, recipient_type, enabled) VALUES
  ('submission', 'submitter', true),
  ('submission', 'dept_ep', true),
  ('manager_approved', 'submitter', true),
  ('manager_approved', 'admin', true),
  ('manager_approved', 'operations', true),
  ('manager_rejected', 'submitter', true),
  ('ready_for_payment', 'submitter', true),
  ('ready_for_payment', 'finance', true),
  ('paid', 'submitter', true),
  ('paid', 'admin', true),
  ('paid', 'producers', true),
  ('manager_assigned', 'dept_ep', true),
  ('resubmitted', 'dept_ep', true),
  ('admin_approved', 'submitter', true),
  ('admin_approved', 'finance', true)
ON CONFLICT (stage_key, recipient_type) DO NOTHING;
