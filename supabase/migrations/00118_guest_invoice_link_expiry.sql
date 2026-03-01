INSERT INTO app_settings (key, value) VALUES
  ('guest_invoice_link_expiry_days', to_jsonb(7::int))
ON CONFLICT (key) DO NOTHING;
