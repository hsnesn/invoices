-- Per-user invoice column visibility and order preference.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invoice_visible_columns jsonb DEFAULT NULL;
COMMENT ON COLUMN profiles.invoice_visible_columns IS 'Array of column keys for invoice list visibility and order, e.g. ["checkbox","status","guest",...]';
