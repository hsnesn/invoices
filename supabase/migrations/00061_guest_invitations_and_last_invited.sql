-- Guest invitations history and last_invited_at on guest_contacts

ALTER TABLE guest_contacts
  ADD COLUMN IF NOT EXISTS last_invited_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN guest_contacts.last_invited_at IS 'When this guest was last sent an invitation email';

CREATE TABLE IF NOT EXISTS guest_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_contact_id uuid REFERENCES guest_contacts(id) ON DELETE SET NULL,
  program_name text NOT NULL,
  topic text,
  record_date text,
  record_time text,
  format text CHECK (format IN ('remote', 'studio')),
  studio_address text,
  producer_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  producer_name text,
  producer_email text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_invitations_guest ON guest_invitations(guest_name, guest_email);
CREATE INDEX IF NOT EXISTS idx_guest_invitations_sent_at ON guest_invitations(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_invitations_contact ON guest_invitations(guest_contact_id);

ALTER TABLE guest_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_invitations_select"
  ON guest_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND (p.role = 'admin' OR (p.allowed_pages IS NOT NULL AND 'guest_contacts' = ANY(p.allowed_pages)))
    )
  );

CREATE POLICY "guest_invitations_insert"
  ON guest_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND (p.role = 'admin' OR (p.allowed_pages IS NOT NULL AND 'guest_contacts' = ANY(p.allowed_pages)))
    )
  );
