-- RPC to update logo setting by key. Bypasses any client-side jsonb serialization issues.
create or replace function update_logo_setting(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into app_settings (key, value, updated_at)
  values (p_key, to_jsonb(p_value), now())
  on conflict (key) do update set
    value = to_jsonb(p_value),
    updated_at = now();
end;
$$;
