-- Guest invoice email stages: link sent, invoice submitted/created.
-- Allows toggling who receives emails when guest gets submit link or submits invoice.
INSERT INTO email_stage_settings (stage_key, enabled) VALUES
  ('guest_link_sent', true),
  ('guest_invoice_submitted', true)
ON CONFLICT (stage_key) DO NOTHING;

INSERT INTO email_recipient_settings (stage_key, recipient_type, enabled) VALUES
  ('guest_link_sent', 'guest', true),
  ('guest_invoice_submitted', 'guest', true),
  ('guest_invoice_submitted', 'producer', true)
ON CONFLICT (stage_key, recipient_type) DO NOTHING;
