-- Invoice notes / comments
CREATE TABLE IF NOT EXISTS invoice_notes (
  id bigserial PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_invoice_notes_invoice ON invoice_notes(invoice_id);
CREATE INDEX idx_invoice_notes_created ON invoice_notes(created_at);

ALTER TABLE invoice_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select" ON invoice_notes FOR SELECT
  TO authenticated USING (
    can_see_invoice(invoice_id, auth.uid())
  );

CREATE POLICY "notes_insert" ON invoice_notes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "notes_delete" ON invoice_notes FOR DELETE
  TO authenticated USING (
    author_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
