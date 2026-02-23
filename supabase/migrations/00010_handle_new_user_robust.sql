-- Robust handle_new_user: ON CONFLICT + exception handler
-- Prevents "Database error saving new user" when inviting.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  inv user_invitations;
BEGIN
  SELECT * INTO inv FROM user_invitations 
  WHERE LOWER(email) = LOWER(NEW.email) 
  AND accepted = false 
  ORDER BY invited_at DESC 
  LIMIT 1;
  
  IF inv IS NOT NULL THEN
    INSERT INTO profiles (id, full_name, role, department_id, program_ids, is_active)
    VALUES (
      NEW.id,
      COALESCE(inv.full_name, NEW.raw_user_meta_data->>'full_name', ''),
      inv.role,
      inv.department_id,
      COALESCE(inv.program_ids, '{}'),
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      department_id = EXCLUDED.department_id,
      program_ids = EXCLUDED.program_ids,
      is_active = true;
  ELSE
    INSERT INTO profiles (id, full_name, role, is_active)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      'submitter',
      false
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Last resort: ensure minimal profile so user creation succeeds
  INSERT INTO profiles (id, full_name, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'submitter',
    true
  )
  ON CONFLICT (id) DO UPDATE SET is_active = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
