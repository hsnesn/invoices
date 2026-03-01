-- Exclude "other" invoices from scoped invoice_number unique constraint.
-- Other invoices extract numbers from external documents (e.g. Uber "Individual")
-- and can legitimately duplicate across different vendor statements.
-- The constraint remains for guest, freelancer, salary invoices.

DROP INDEX IF EXISTS idx_invoices_number_scoped;

CREATE UNIQUE INDEX idx_invoices_number_scoped
ON invoices (
  submitter_user_id,
  invoice_number,
  (EXTRACT(YEAR FROM COALESCE(service_date_from, (created_at AT TIME ZONE 'UTC')::date))::int * 12 + EXTRACT(MONTH FROM COALESCE(service_date_from, (created_at AT TIME ZONE 'UTC')::date))::int)
)
WHERE invoice_number IS NOT NULL
  AND invoice_number != ''
  AND invoice_type != 'other';
