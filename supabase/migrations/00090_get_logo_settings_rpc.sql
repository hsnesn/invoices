-- RPC to read logo settings. Use for consistent read (avoids replica lag).
create or replace function get_logo_settings()
returns table(key text, value text, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select app_settings.key, app_settings.value::text, app_settings.updated_at
  from app_settings
  where app_settings.key in ('logo_trt', 'logo_trt_world', 'logo_email');
$$;
