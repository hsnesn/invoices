-- Guest contacts visibility and export settings (configurable in Setup)
-- producer_scoped: when true, producers (submitters) see only contacts from invoices they submitted
-- export_restricted: when true, only admin and users in export_user_ids can export
INSERT INTO app_settings (key, value) VALUES
  ('guest_contacts_producer_scoped', 'false'::jsonb),
  ('guest_contacts_export_restricted', 'false'::jsonb),
  ('guest_contacts_export_user_ids', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
