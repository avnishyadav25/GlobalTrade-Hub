-- Key/value app-state store for full cloud sync of the client stores
-- (paper, agents, coach, connections, ui). Per-user, RLS-protected.

create table if not exists public.gth_app_state (
  user_id uuid not null,
  key text not null,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.gth_app_state enable row level security;
drop policy if exists gth_app_state_owner on public.gth_app_state;
create policy gth_app_state_owner on public.gth_app_state
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Note: the app writes app-state via the service-role key in server API routes
-- (single super-admin), so it is not gated by auth.uid(); the policy above still
-- protects any direct authenticated/anon client access.
