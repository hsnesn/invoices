-- Security hardening: atomic login lockout, MFA attempt tracking, RLS for mapping tables

------------------------------------------------------------------------
-- 1. Atomic login lockout function (prevents race condition)
------------------------------------------------------------------------
-- check_login_lockout: read-only check (also clears expired locks)
CREATE OR REPLACE FUNCTION check_login_lockout(p_email text)
RETURNS TABLE(is_locked boolean, locked_until_ts timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row login_failed_attempts%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM login_failed_attempts
  WHERE email = p_email
  FOR UPDATE;

  IF v_row IS NULL THEN
    RETURN QUERY SELECT false::boolean, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until <= now() THEN
    DELETE FROM login_failed_attempts WHERE email = p_email;
    RETURN QUERY SELECT false::boolean, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RETURN QUERY SELECT true::boolean, v_row.locked_until;
    RETURN;
  END IF;

  RETURN QUERY SELECT false::boolean, NULL::timestamptz;
END;
$$;

-- record_failed_login: atomically increment counter, returns new state
CREATE OR REPLACE FUNCTION record_failed_login(
  p_email text,
  p_max_attempts int DEFAULT 3,
  p_lockout_minutes int DEFAULT 30
)
RETURNS TABLE(is_locked boolean, attempts int, locked_until_ts timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now timestamptz := now();
  v_lock timestamptz;
  v_count int;
BEGIN
  INSERT INTO login_failed_attempts (email, attempt_count, updated_at, locked_until)
  VALUES (p_email, 1, v_now, NULL)
  ON CONFLICT (email) DO UPDATE SET
    attempt_count = login_failed_attempts.attempt_count + 1,
    updated_at = v_now
  RETURNING login_failed_attempts.attempt_count INTO v_count;

  IF v_count >= p_max_attempts THEN
    v_lock := v_now + (p_lockout_minutes || ' minutes')::interval;
    UPDATE login_failed_attempts
    SET locked_until = v_lock
    WHERE email = p_email;
    RETURN QUERY SELECT true::boolean, v_count, v_lock;
  ELSE
    RETURN QUERY SELECT false::boolean, v_count, NULL::timestamptz;
  END IF;
END;
$$;

------------------------------------------------------------------------
-- 2. MFA OTP verify_attempts column
------------------------------------------------------------------------
ALTER TABLE mfa_otp_codes ADD COLUMN IF NOT EXISTS verify_attempts int NOT NULL DEFAULT 0;

------------------------------------------------------------------------
-- 3. Optimistic locking: version column on invoice_workflows
------------------------------------------------------------------------
ALTER TABLE invoice_workflows ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;

------------------------------------------------------------------------
-- 4. Atomic invoice creation (invoice + workflow + extracted_fields)
------------------------------------------------------------------------
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
BEGIN
  INSERT INTO invoices (
    id, submitter_user_id, department_id, program_id,
    service_description, service_date_from, service_date_to,
    currency, storage_path, invoice_type
  ) VALUES (
    p_id, p_submitter, p_dept, p_prog,
    p_desc, NULLIF(p_date_from,''), NULLIF(p_date_to,''),
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

------------------------------------------------------------------------
-- 5. RLS on unprotected mapping tables
------------------------------------------------------------------------
ALTER TABLE title_category_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_category_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read title mappings"
  ON title_category_mapping FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read topic mappings"
  ON topic_category_mapping FOR SELECT
  TO authenticated
  USING (true);
