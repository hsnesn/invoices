-- Fix: service_date_from and service_date_to expect date type but RPC receives text.
-- Cast text to date for proper insertion.
CREATE OR REPLACE FUNCTION create_invoice_with_workflow(
  p_id uuid,
  p_submitter uuid,
  p_dept uuid,
  p_prog uuid,
  p_desc text,
  p_date_from text,
  p_date_to text,
  p_currency text,
  p_path text,
  p_type text,
  p_manager uuid,
  p_filename text,
  p_currency_extracted text DEFAULT 'GBP'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date_from date;
  v_date_to date;
BEGIN
  v_date_from := CASE WHEN NULLIF(TRIM(p_date_from), '') IS NOT NULL
    THEN (NULLIF(TRIM(p_date_from), ''))::date
    ELSE NULL END;
  v_date_to := CASE WHEN NULLIF(TRIM(p_date_to), '') IS NOT NULL
    THEN (NULLIF(TRIM(p_date_to), ''))::date
    ELSE NULL END;

  INSERT INTO invoices (
    id, submitter_user_id, department_id, program_id,
    service_description, service_date_from, service_date_to,
    currency, storage_path, invoice_type
  ) VALUES (
    p_id, p_submitter, p_dept, p_prog,
    p_desc, v_date_from, v_date_to,
    p_currency, p_path, p_type
  );

  INSERT INTO invoice_workflows (
    invoice_id, status, manager_user_id, pending_manager_since
  ) VALUES (
    p_id, 'pending_manager', p_manager, current_date
  );

  INSERT INTO invoice_extracted_fields (
    invoice_id, invoice_number, extracted_currency,
    needs_review, manager_confirmed, raw_json, updated_at
  ) VALUES (
    p_id, p_filename, p_currency_extracted,
    true, false,
    jsonb_build_object('source_file_name', p_filename),
    now()
  );
END;
$$;
