-- Guest invitation email stage: who receives when invitation is sent (guest + producer copy).
INSERT INTO email_stage_settings (stage_key, enabled) VALUES
  ('guest_invitation_sent', true)
ON CONFLICT (stage_key) DO NOTHING;

INSERT INTO email_recipient_settings (stage_key, recipient_type, enabled) VALUES
  ('guest_invitation_sent', 'guest', true),
  ('guest_invitation_sent', 'producer', true)
ON CONFLICT (stage_key, recipient_type) DO NOTHING;
