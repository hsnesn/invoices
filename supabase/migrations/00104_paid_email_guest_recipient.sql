-- Add "guest" as recipient for paid stage: guest (payment recipient) receives email when invoice is marked paid.
INSERT INTO email_recipient_settings (stage_key, recipient_type, enabled) VALUES
  ('paid', 'guest', true)
ON CONFLICT (stage_key, recipient_type) DO NOTHING;
