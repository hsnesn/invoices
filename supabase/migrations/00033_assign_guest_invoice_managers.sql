-- Assign line managers (Dept EP) to existing guest invoices by department:
-- Programmes -> Alice Tegg
-- TRT World News -> Tarik Zarroug

DO $$
DECLARE
  alice_id uuid;
  tarik_id uuid;
  updated_programmes int;
  updated_news int;
BEGIN
  SELECT id INTO alice_id FROM profiles WHERE full_name ILIKE '%Alice Tegg%' AND is_active = true LIMIT 1;
  SELECT id INTO tarik_id FROM profiles WHERE full_name ILIKE '%Tarik Zarroug%' AND is_active = true LIMIT 1;

  IF alice_id IS NOT NULL THEN
    WITH dept_programmes AS (
      SELECT id FROM departments WHERE name ILIKE 'Programmes' LIMIT 1
    )
    UPDATE invoice_workflows iw
    SET manager_user_id = alice_id, updated_at = now()
    FROM invoices i
    JOIN dept_programmes d ON i.department_id = d.id
    WHERE iw.invoice_id = i.id
      AND i.invoice_type = 'guest';
    GET DIAGNOSTICS updated_programmes = ROW_COUNT;
  END IF;

  IF tarik_id IS NOT NULL THEN
    UPDATE invoice_workflows iw
    SET manager_user_id = tarik_id, updated_at = now()
    FROM invoices i
    JOIN departments d ON i.department_id = d.id
    WHERE iw.invoice_id = i.id
      AND i.invoice_type = 'guest'
      AND (d.name ILIKE 'TRT World News' OR d.name ILIKE 'News Output' OR d.name ILIKE 'News Input');
    GET DIAGNOSTICS updated_news = ROW_COUNT;
  END IF;
END $$;
