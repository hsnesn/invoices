-- Store extracted guest contacts from bulk uploads (persists after scan invoices are deleted)
CREATE TABLE IF NOT EXISTS guest_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name text NOT NULL,
  guest_name_key text GENERATED ALWAYS AS (LOWER(TRIM(guest_name))) STORED,
  phone text,
  email text,
  title text,
  source text DEFAULT 'bulk_upload',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_contacts_name_key
  ON guest_contacts (guest_name_key);

CREATE INDEX IF NOT EXISTS idx_guest_contacts_updated ON guest_contacts(updated_at DESC);

ALTER TABLE guest_contacts ENABLE ROW LEVEL SECURITY;

-- Admin and users with guest_contacts page access can read
CREATE POLICY "guest_contacts_select"
  ON guest_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND (p.role = 'admin' OR (p.allowed_pages IS NOT NULL AND 'guest_contacts' = ANY(p.allowed_pages)))
    )
  );

-- Only admin can insert/update/delete (bulk upload flow)
CREATE POLICY "guest_contacts_admin_all"
  ON guest_contacts FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
