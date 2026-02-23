-- Fix: Add ON CONFLICT to handle_new_user trigger to prevent
-- "Database error saving new user" when re-inviting existing users.

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
      NEW.raw_user_meta_data->>'full_name',
      'submitter',
      false
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
