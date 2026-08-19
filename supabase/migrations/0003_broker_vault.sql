-- Broker credential storage via Supabase Vault.
--
-- Two problems this fixes:
--
-- 1. `gth_broker_connections.user_id` references `auth.users(id)`, but this app
--    authenticates with a single env super-admin and `auth.users` is empty by design.
--    Every insert keyed to ADMIN_USER_ID therefore failed on a foreign-key violation.
--    The FK is wrong for this auth model, so it is dropped. RLS stays enabled.
--
-- 2. The `vault` schema is not exposed through PostgREST, so supabase-js cannot call
--    `vault.create_secret` directly. These SECURITY DEFINER wrappers in `public` are
--    the only way in, and EXECUTE is granted ONLY to service_role.
--
-- SECURITY NOTE: these functions can read any secret by name. The secret name must be
-- derived SERVER-SIDE (gth:{admin_user_id}:{broker}:{mode}) and never taken from a
-- request body — otherwise this becomes an arbitrary-secret-read primitive.

-- 1. Drop the auth.users FK -------------------------------------------------
alter table public.gth_broker_connections
  drop constraint if exists gth_broker_connections_user_id_fkey;

-- Track verification so the UI can show a truthful "connected" state.
alter table public.gth_broker_connections
  add column if not exists last_verified_at timestamptz,
  add column if not exists account_ref text,
  add column if not exists last_error text;

-- One connection per (user, broker, mode) so re-connecting updates in place
-- instead of creating duplicate rows.
create unique index if not exists gth_broker_connections_uniq
  on public.gth_broker_connections (user_id, broker_id, mode);

-- 2. Vault wrappers ---------------------------------------------------------
create extension if not exists supabase_vault with schema vault;

create or replace function public.gth_vault_store(p_name text, p_secret text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then
    select vault.create_secret(p_secret, p_name, 'GlobalTrade Hub broker credentials') into v_id;
  else
    perform vault.update_secret(v_id, p_secret, p_name);
  end if;
  return v_id;
end;
$$;

create or replace function public.gth_vault_read(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = p_name;
  return v_secret;
end;
$$;

create or replace function public.gth_vault_delete(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets where name = p_name;
end;
$$;

-- 3. Lock the wrappers down -------------------------------------------------
revoke all on function public.gth_vault_store(text, text) from public, anon, authenticated;
revoke all on function public.gth_vault_read(text) from public, anon, authenticated;
revoke all on function public.gth_vault_delete(text) from public, anon, authenticated;

grant execute on function public.gth_vault_store(text, text) to service_role;
grant execute on function public.gth_vault_read(text) to service_role;
grant execute on function public.gth_vault_delete(text) to service_role;
