-- Storage bucket creation (run via Supabase dashboard or API - bucket must be PRIVATE)
-- This migration documents the bucket name: invoices
-- Create bucket manually: Storage > New bucket > invoices > Private

-- Auto-create profile when user signs up (for invited users - profile will be updated when invitation accepted)
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
    -- Create profile from invitation
    INSERT INTO profiles (id, full_name, role, department_id, program_ids, is_active)
    VALUES (
      NEW.id,
      COALESCE(inv.full_name, NEW.raw_user_meta_data->>'full_name', ''),
      inv.role,
      inv.department_id,
      COALESCE(inv.program_ids, '{}'),
      true
    );
    -- Mark invitation as accepted
    UPDATE user_invitations 
    SET accepted = true, accepted_at = now() 
    WHERE id = inv.id;
  ELSE
    -- No invitation - create minimal profile (submitter, inactive until invited)
    -- For invite-only: we could make is_active = false so they can't use the app
    INSERT INTO profiles (id, full_name, role, is_active)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'full_name',
      'submitter',
      false  -- Must be invited to become active
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert (requires extension or trigger on auth schema)
-- Note: Supabase handles this via Database Webhooks or you create trigger in auth schema
-- Alternative: Use Supabase Auth Hook (Edge Function) or handle in app on first login
-- For migration: We create a trigger - Supabase allows this via migration

-- Drop if exists for idempotency
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
