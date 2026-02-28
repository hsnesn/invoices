-- Configurable delete permissions: which roles can delete invoices.
-- Stored in app_settings. When null, use default: admin, finance, operations, submitter.
INSERT INTO app_settings (key, value) VALUES
  ('roles_can_delete_invoices', '["admin", "finance", "operations", "submitter"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
