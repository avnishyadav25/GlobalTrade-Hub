-- GlobalTrade Hub — schema (all tables prefixed gth_ to coexist safely in any project)
-- Apply with: supabase db push  (or the Supabase MCP apply_migration).
-- Every table is per-user with Row Level Security. Broker SECRETS are NOT stored
-- in these tables — put them in Supabase Vault (see note at the bottom).

create extension if not exists "pgcrypto";

-- Profiles ------------------------------------------------------------------
create table if not exists public.gth_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  base_currency text not null default 'INR',
  created_at timestamptz not null default now()
);

-- Broker connections (metadata only; no secrets) ----------------------------
create table if not exists public.gth_broker_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  broker_id text not null,
  label text not null,
  mode text not null check (mode in ('paper','live')),
  status text not null default 'disconnected',
  vault_secret_name text,               -- reference into Supabase Vault
  created_at timestamptz not null default now()
);

-- Watchlist -----------------------------------------------------------------
create table if not exists public.gth_watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  sort int not null default 0,
  unique (user_id, symbol)
);

-- Paper account -------------------------------------------------------------
create table if not exists public.gth_paper_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  base_currency text not null default 'INR',
  cash numeric not null default 500000,
  starting_cash numeric not null default 500000,
  updated_at timestamptz not null default now()
);

-- Orders / positions / fills (both paper & live) ----------------------------
create table if not exists public.gth_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.gth_broker_connections(id) on delete set null,
  is_paper boolean not null default true,
  symbol text not null,
  market text not null,
  side text not null check (side in ('buy','sell')),
  type text not null check (type in ('market','limit','stop','stop_limit')),
  qty numeric not null,
  limit_price numeric,
  stop_price numeric,
  filled_qty numeric not null default 0,
  avg_fill_price numeric not null default 0,
  status text not null default 'open',
  fees numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gth_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  is_paper boolean not null default true,
  symbol text not null,
  market text not null,
  qty numeric not null,
  avg_price numeric not null,
  realized_pnl numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, is_paper, symbol)
);

create table if not exists public.gth_fills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.gth_orders(id) on delete set null,
  is_paper boolean not null default true,
  symbol text not null,
  side text not null,
  qty numeric not null,
  price numeric not null,
  fee numeric not null default 0,
  pnl numeric not null default 0,
  ts timestamptz not null default now()
);

-- Alerts, strategies, backtests, coach --------------------------------------
create table if not exists public.gth_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  direction text not null check (direction in ('above','below')),
  price numeric not null,
  triggered boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.gth_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  params jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.gth_backtests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  strategy_id uuid references public.gth_strategies(id) on delete set null,
  params jsonb not null default '{}',
  results jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.gth_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  side text,
  pnl numeric,
  mood text,
  note text,
  ts timestamptz not null default now()
);

create table if not exists public.gth_coach_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id text not null,
  enabled boolean not null default true,
  unique (user_id, rule_id)
);

create table if not exists public.gth_coach_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report jsonb not null,
  source text not null default 'heuristic',
  created_at timestamptz not null default now()
);

-- Row Level Security --------------------------------------------------------
-- Profiles are keyed by id = auth.uid(); every other table by user_id = auth.uid().
alter table public.gth_profiles enable row level security;
drop policy if exists gth_profiles_owner on public.gth_profiles;
create policy gth_profiles_owner on public.gth_profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'gth_broker_connections','gth_watchlist_items','gth_paper_accounts',
    'gth_orders','gth_positions','gth_fills','gth_alerts','gth_strategies',
    'gth_backtests','gth_journal_entries','gth_coach_rules','gth_coach_reports'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %1$I_owner on public.%1$I;', t);
    execute format(
      'create policy %1$I_owner on public.%1$I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());',
      t
    );
  end loop;
end $$;

-- SECRETS: store broker API keys in Supabase Vault, referenced by
-- gth_broker_connections.vault_secret_name, e.g.
--   select vault.create_secret('{"apiKey":"..."}', 'gth:'||auth.uid()||':alpaca');
-- Server code reads them with the service-role key inside API routes only.
