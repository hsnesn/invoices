-- New RPC that updates and returns the stored value for verification
create or replace function update_logo_setting_and_return(p_key text, p_value text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stored text;
begin
  insert into app_settings (key, value, updated_at)
  values (p_key, to_jsonb(p_value), now())
  on conflict (key) do update set
    value = to_jsonb(p_value),
    updated_at = now();
  select value::text into v_stored from app_settings where key = p_key;
  return v_stored;
end;
$$;
