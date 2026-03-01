-- Company & contact settings for Setup. Editable without code changes.
INSERT INTO app_settings (key, value) VALUES
  ('company_name', '"TRT WORLD (UK)"'::jsonb),
  ('company_address', '"200 Grays Inn Road, London, WC1X 8XZ"'::jsonb),
  ('signature_name', '"Hasan ESEN"'::jsonb),
  ('studio_address', '"TRT World London Studios 200 Gray''s Inn Rd, London WC1X 8XZ"'::jsonb),
  ('email_operations', '"london.operations@trtworld.com"'::jsonb),
  ('email_finance', '"london.finance@trtworld.com"'::jsonb),
  ('email_bank_transfer', '"london.finance@trtworld.com"'::jsonb),
  ('bank_account_gbp', '"0611-405810-001"'::jsonb),
  ('bank_account_eur', '"0611-405810-009"'::jsonb),
  ('bank_account_usd', '"0611-405810-002"'::jsonb),
  ('app_name', '"TRT UK Operations Platform"'::jsonb)
ON CONFLICT (key) DO NOTHING;
