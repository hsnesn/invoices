-- Ensure invoice_files table exists (in case 00017 was skipped or table was dropped)
CREATE TABLE IF NOT EXISTS invoice_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_files_invoice ON invoice_files(invoice_id);

-- Backfill: migrate existing storage_path to invoice_files for freelancer invoices
INSERT INTO invoice_files (invoice_id, storage_path, file_name, sort_order)
SELECT id, storage_path,
  COALESCE(REGEXP_REPLACE(storage_path, '^.*/', ''), storage_path),
  0
FROM invoices
WHERE storage_path IS NOT NULL
  AND invoice_type = 'freelancer'
  AND NOT EXISTS (SELECT 1 FROM invoice_files WHERE invoice_files.invoice_id = invoices.id);

ALTER TABLE invoice_files ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DROP POLICY IF EXISTS "invoice_files_select_via_invoice" ON invoice_files;
CREATE POLICY "invoice_files_select_via_invoice"
  ON invoice_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN invoice_workflows iw ON iw.invoice_id = i.id
      JOIN profiles p ON p.id = auth.uid() AND p.is_active = true
      WHERE i.id = invoice_files.invoice_id
        AND (
          p.role = 'admin'
          OR p.role = 'operations'
          OR p.role = 'viewer'
          OR i.submitter_user_id = auth.uid()
          OR iw.manager_user_id = auth.uid()
          OR (p.role = 'manager' AND p.department_id = i.department_id)
          OR (p.role = 'manager' AND p.program_ids @> ARRAY[i.program_id])
          OR (p.role = 'finance' AND iw.status IN ('ready_for_payment','paid','archived'))
          OR EXISTS (SELECT 1 FROM operations_room_members o WHERE o.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "invoice_files_insert_admin_manager_submitter" ON invoice_files;
CREATE POLICY "invoice_files_insert_admin_manager_submitter"
  ON invoice_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN profiles p ON p.id = auth.uid() AND p.is_active = true
      WHERE i.id = invoice_files.invoice_id
        AND (p.role = 'admin' OR p.role = 'manager' OR p.role = 'operations' OR i.submitter_user_id = auth.uid())
    )
  );
