-- 1. Add producer_user_id to invoices (secure producer access; no text parsing)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS producer_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_producer_user ON invoices(producer_user_id) WHERE producer_user_id IS NOT NULL;
COMMENT ON COLUMN invoices.producer_user_id IS 'Producer user ID for guest invoices (admin uploads on behalf). Used for RLS; replaces insecure service_description parsing.';

-- 2. Backfill producer_user_id from service_description where producer name matches a profile
CREATE OR REPLACE FUNCTION parse_producer_from_desc(desc_text text)
RETURNS text AS $$
  SELECT TRIM(SUBSTRING(TRIM(line) FROM POSITION(':' IN TRIM(line)) + 1))
  FROM unnest(string_to_array(desc_text, E'\n')) AS line
  WHERE LOWER(TRIM(SPLIT_PART(TRIM(line), ':', 1))) = 'producer'
  LIMIT 1;
$$ LANGUAGE sql IMMUTABLE;

UPDATE invoices i
SET producer_user_id = (
  SELECT p.id FROM profiles p
  WHERE p.is_active = true
    AND LOWER(TRIM(p.full_name)) = LOWER(TRIM(parse_producer_from_desc(i.service_description)))
  LIMIT 1
)
WHERE i.producer_user_id IS NULL
  AND i.service_description IS NOT NULL
  AND i.invoice_type = 'guest'
  AND parse_producer_from_desc(i.service_description) IS NOT NULL;

-- 3. Scoped unique: (submitter_user_id, invoice_number, year_month) per invoice
-- Add invoice_number to invoices for constraint (synced from extracted_fields)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number text;
COMMENT ON COLUMN invoices.invoice_number IS 'Denormalized from invoice_extracted_fields for scoped unique constraint.';

-- Sync existing data from invoice_extracted_fields
UPDATE invoices i
SET invoice_number = e.invoice_number
FROM invoice_extracted_fields e
WHERE e.invoice_id = i.id
  AND e.invoice_number IS NOT NULL
  AND e.invoice_number != ''
  AND (i.invoice_number IS NULL OR i.invoice_number != e.invoice_number);

-- Trigger: keep invoice_number in sync when extracted_fields changes
CREATE OR REPLACE FUNCTION sync_invoice_number_to_invoices()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices
  SET invoice_number = CASE WHEN NEW.invoice_number IS NOT NULL AND NEW.invoice_number != '' THEN NEW.invoice_number ELSE NULL END
  WHERE id = NEW.invoice_id
    AND (invoice_number IS DISTINCT FROM (CASE WHEN NEW.invoice_number IS NOT NULL AND NEW.invoice_number != '' THEN NEW.invoice_number ELSE NULL END));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_invoice_number_trigger ON invoice_extracted_fields;
CREATE TRIGGER sync_invoice_number_trigger
  AFTER INSERT OR UPDATE OF invoice_number ON invoice_extracted_fields
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_number_to_invoices();

-- Scoped unique index (submitter + number + year_month)
-- Use year*12+month for immutable expression (same month = same value)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_scoped
ON invoices (
  submitter_user_id,
  invoice_number,
  (EXTRACT(YEAR FROM COALESCE(service_date_from, (created_at AT TIME ZONE 'UTC')::date))::int * 12 + EXTRACT(MONTH FROM COALESCE(service_date_from, (created_at AT TIME ZONE 'UTC')::date))::int)
)
WHERE invoice_number IS NOT NULL AND invoice_number != '';
