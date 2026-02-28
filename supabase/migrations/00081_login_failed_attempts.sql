-- Track failed login attempts for lockout after 3 attempts
-- Lockout duration: 30 minutes

create table if not exists public.login_failed_attempts (
  email text not null,
  attempt_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (email)
);

-- RLS: block anon/authenticated; service role bypasses RLS
alter table public.login_failed_attempts enable row level security;

create policy "No direct access"
  on public.login_failed_attempts
  for all
  using (false)
  with check (false);

grant all on public.login_failed_attempts to service_role;
