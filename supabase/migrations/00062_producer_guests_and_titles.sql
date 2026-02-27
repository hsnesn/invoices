-- Producer's invited guests (producer-scoped list)
-- Email hidden until sent; after send, saved and selectable

CREATE TABLE IF NOT EXISTS producer_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  email text,
  title text,
  program_name text,
  invited_at timestamptz,
  accepted boolean,
  matched_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  matched_at timestamptz,
  guest_contact_id uuid REFERENCES guest_contacts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_producer_guests_producer ON producer_guests(producer_user_id);
CREATE INDEX IF NOT EXISTS idx_producer_guests_invited ON producer_guests(invited_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_producer_guests_matched ON producer_guests(matched_invoice_id) WHERE matched_invoice_id IS NOT NULL;

ALTER TABLE producer_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "producer_guests_select_own"
  ON producer_guests FOR SELECT
  USING (producer_user_id = auth.uid());

CREATE POLICY "producer_guests_select_admin"
  ON producer_guests FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "producer_guests_insert_own"
  ON producer_guests FOR INSERT
  WITH CHECK (producer_user_id = auth.uid());

CREATE POLICY "producer_guests_update_own"
  ON producer_guests FOR UPDATE
  USING (producer_user_id = auth.uid());

CREATE POLICY "producer_guests_insert_admin"
  ON producer_guests FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "producer_guests_update_admin"
  ON producer_guests FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Global guest titles (dropdown options)
CREATE TABLE IF NOT EXISTS guest_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_titles_name ON guest_titles(name);

ALTER TABLE guest_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_titles_select_authenticated"
  ON guest_titles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "guest_titles_insert_admin"
  ON guest_titles FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "guest_titles_insert_authenticated"
  ON guest_titles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Seed common titles
INSERT INTO guest_titles (name) VALUES
  ('Professor'), ('Dr'), ('Mr'), ('Ms'), ('Ambassador'), ('Analyst'),
  ('Journalist'), ('Academic'), ('Expert'), ('Commentator'), ('Politician')
ON CONFLICT (name) DO NOTHING;
