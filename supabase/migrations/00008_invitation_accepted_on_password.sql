-- Fix: Only mark invitation as accepted when user completes password setup,
-- not when they merely click the invite link (which creates auth.users record).
-- The accept-invite page will call an API to mark accepted after password is set.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  inv user_invitations;
BEGIN
  -- Check if user has a pending invitation
  SELECT * INTO inv FROM user_invitations 
  WHERE LOWER(email) = LOWER(NEW.email) 
  AND accepted = false 
  ORDER BY invited_at DESC 
  LIMIT 1;
  
  IF inv IS NOT NULL THEN
    -- Create profile from invitation (do NOT mark accepted yet - user must set password first)
    INSERT INTO profiles (id, full_name, role, department_id, program_ids, is_active)
    VALUES (
      NEW.id,
      COALESCE(inv.full_name, NEW.raw_user_meta_data->>'full_name', ''),
      inv.role,
      inv.department_id,
      COALESCE(inv.program_ids, '{}'),
      true
    );
    -- Do NOT update accepted here - will be set when user completes password on /auth/accept-invite
  ELSE
    -- No invitation - create minimal profile (submitter, inactive until invited)
    INSERT INTO profiles (id, full_name, role, is_active)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'full_name',
      'submitter',
      false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
