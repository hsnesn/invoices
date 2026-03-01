-- Office request new, completed, and reminder due email stages.
INSERT INTO email_stage_settings (stage_key, enabled) VALUES
  ('office_request_new', true),
  ('office_request_completed', true),
  ('reminder_due', true)
ON CONFLICT (stage_key) DO NOTHING;

INSERT INTO email_recipient_settings (stage_key, recipient_type, enabled) VALUES
  ('office_request_new', 'operations', true),
  ('office_request_completed', 'requester', true),
  ('office_request_completed', 'admin', true),
  ('reminder_due', 'assignee', true),
  ('reminder_due', 'admin', true)
ON CONFLICT (stage_key, recipient_type) DO NOTHING;
