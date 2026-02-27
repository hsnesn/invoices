-- Approval delegations: backup approvers when manager is absent
-- delegator_user_id = manager delegating; delegate_user_id = backup approver
-- valid_from/valid_until = date range when delegation is active

create table if not exists approval_delegations (
  id uuid primary key default gen_random_uuid(),
  delegator_user_id uuid not null references auth.users(id) on delete cascade,
  delegate_user_id uuid not null references auth.users(id) on delete cascade,
  valid_from date not null,
  valid_until date not null,
  created_at timestamptz default now(),
  constraint valid_date_range check (valid_until >= valid_from),
  constraint no_self_delegation check (delegator_user_id != delegate_user_id)
);

create index idx_approval_delegations_delegator on approval_delegations(delegator_user_id);
create index idx_approval_delegations_delegate on approval_delegations(delegate_user_id);
create index idx_approval_delegations_dates on approval_delegations(valid_from, valid_until);

-- RLS: only admins can manage delegations
alter table approval_delegations enable row level security;

create policy "Admins can manage approval_delegations"
  on approval_delegations
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

