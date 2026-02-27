-- Track when invoice entered pending_manager for SLA reminders
alter table invoice_workflows
  add column if not exists pending_manager_since date;

-- Settings table for configurable values (SLA days, digest frequency)
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- Default: 5 days SLA for manager approval (value stored as jsonb number)
insert into app_settings (key, value) values ('manager_sla_days', to_jsonb(5::int))
  on conflict (key) do nothing;

-- Digest: daily = 1, weekly = 7
insert into app_settings (key, value) values ('pending_digest_frequency_days', to_jsonb(1::int))
  on conflict (key) do nothing;

-- RLS: admins can manage settings
alter table app_settings enable row level security;
create policy "Admins can manage app_settings"
  on app_settings for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin' and is_active = true))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin' and is_active = true));

-- Backfill pending_manager_since for existing pending_manager invoices
update invoice_workflows
set pending_manager_since = coalesce(
  (select date(min(created_at)) from audit_events
   where invoice_id = invoice_workflows.invoice_id and to_status = 'pending_manager'),
  date(updated_at)
)
where status = 'pending_manager' and pending_manager_since is null;
