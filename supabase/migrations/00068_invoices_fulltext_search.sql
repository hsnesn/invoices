-- Full-text search for guest/salary invoices
-- Searches: service_description, beneficiary_name, invoice_number, account_number, tags

CREATE OR REPLACE FUNCTION search_invoices(search_query text)
RETURNS TABLE(invoice_id uuid)
LANGUAGE sql
STABLE
AS $$
  SELECT i.id AS invoice_id
  FROM invoices i
  LEFT JOIN invoice_extracted_fields e ON e.invoice_id = i.id
  WHERE i.invoice_type IN ('guest', 'salary')
    AND (
      search_query IS NULL
      OR search_query = ''
      OR (
        setweight(to_tsvector('english', coalesce(i.service_description, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(e.beneficiary_name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(e.invoice_number, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(e.account_number, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(array_to_string(i.tags, ' '), '')), 'C')
      ) @@ plainto_tsquery('english', search_query)
    )
  ORDER BY i.created_at DESC
  LIMIT 500;
$$;

COMMENT ON FUNCTION search_invoices(text) IS 'Full-text search over guest/salary invoices. Returns matching invoice IDs.';
