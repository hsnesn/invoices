-- Email templates: editable in Settings. NULL = use built-in default.
CREATE TABLE IF NOT EXISTS email_templates (
  template_key text PRIMARY KEY,
  subject_template text,
  body_template text,
  variables jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE email_templates IS 'Custom email templates. NULL subject/body = use built-in default.';
COMMENT ON COLUMN email_templates.variables IS 'Available placeholders: {{invoiceNumber}}, {{guestName}}, {{managerName}}, {{reason}}, etc.';

-- Per-stage email enable/disable. Default: all enabled.
CREATE TABLE IF NOT EXISTS email_stage_settings (
  stage_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE email_stage_settings IS 'Enable/disable invoice emails per workflow stage.';

-- Seed stage keys
INSERT INTO email_stage_settings (stage_key, enabled) VALUES
  ('submission', true),
  ('manager_approved', true),
  ('manager_rejected', true),
  ('ready_for_payment', true),
  ('paid', true),
  ('manager_assigned', true),
  ('resubmitted', true),
  ('admin_approved', true)
ON CONFLICT (stage_key) DO NOTHING;

-- User preference: receive invoice update emails (booking form emails always sent)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS receive_invoice_emails boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN profiles.receive_invoice_emails IS 'If false, user does not receive invoice status emails. Booking form emails are always sent.';

-- RLS: only admins can manage email_templates and email_stage_settings
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_stage_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_admin_all" ON email_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

CREATE POLICY "email_stage_settings_admin_all" ON email_stage_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );
