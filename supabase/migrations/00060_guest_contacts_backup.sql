-- Backup table for guest contacts (delete list + restore)
CREATE TABLE IF NOT EXISTS guest_contacts_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backed_up_at timestamptz DEFAULT now(),
  contact_count integer NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '[]'
);

COMMENT ON TABLE guest_contacts_backup IS 'Backup of guest_contacts before delete. Restore copies snapshot back.';
COMMENT ON COLUMN guest_contacts_backup.snapshot IS 'Array of guest contact rows (without id, guest_name_key)';

ALTER TABLE guest_contacts_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_contacts_backup_admin"
  ON guest_contacts_backup FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
