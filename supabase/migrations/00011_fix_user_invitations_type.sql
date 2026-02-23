-- Fix: "type user_invitations does not exist" - trigger runs in auth context
-- Use RECORD + public schema to avoid schema resolution issues.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $fn$
DECLARE
  inv RECORD;
BEGIN
  SELECT * INTO inv FROM public.user_invitations
  WHERE LOWER(email) = LOWER(NEW.email) AND accepted = false
  ORDER BY invited_at DESC LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.profiles (id, full_name, role, department_id, program_ids, is_active)
    VALUES (NEW.id, COALESCE(inv.full_name, NEW.raw_user_meta_data->>'full_name', ''), inv.role, inv.department_id, COALESCE(inv.program_ids, '{}'), true)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id, program_ids = EXCLUDED.program_ids, is_active = true;
  ELSE
    INSERT INTO public.profiles (id, full_name, role, is_active)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'submitter', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'submitter', true)
  ON CONFLICT (id) DO UPDATE SET is_active = true;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;
