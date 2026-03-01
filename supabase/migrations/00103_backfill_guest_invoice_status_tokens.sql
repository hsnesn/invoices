-- Backfill status tokens for guest invoices that don't have one.
-- Fixes "Status link not found" for invoices created before migration 00102.
INSERT INTO guest_invoice_status_tokens (invoice_id, token, guest_name, program_name)
SELECT
  i.id,
  gen_random_uuid(),
  COALESCE(
    NULLIF(TRIM(SUBSTRING(i.service_description FROM 'Guest:\s*([^\n]+)')), ''),
    (SELECT beneficiary_name FROM invoice_extracted_fields WHERE invoice_id = i.id LIMIT 1),
    'Guest'
  ),
  NULLIF(TRIM(SUBSTRING(i.service_description FROM 'Program:\s*([^\n]+)')), '')
FROM invoices i
WHERE i.invoice_type = 'guest'
  AND NOT EXISTS (
    SELECT 1 FROM guest_invoice_status_tokens gist WHERE gist.invoice_id = i.id
  )
ON CONFLICT DO NOTHING;
