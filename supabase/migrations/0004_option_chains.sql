-- Historical option chain snapshots.
--
-- WHY THIS TABLE EXISTS: no free source publishes past Indian option chains. NSE's
-- historical F&O endpoints answer 503, and there is no substitute. So options can be
-- paper-traded against a live chain but cannot be backtested against real premiums —
-- unless history is accumulated going forward, which is what this table does.
--
-- One row per underlying per expiry per trading day, written by the cron tick after the
-- session closes. Roughly two rows a day for NIFTY plus BANKNIFTY at the near expiry.
--
-- The chain is COMPACTED before storage: NSE returns ~240KB of JSON per expiry, most of
-- it fields the backtester will never read. What is kept is strike, last price, implied
-- volatility, open interest and the touch — enough to reprice a position and no more.

create table if not exists public.gth_option_chains (
  user_id uuid not null,
  -- 'NIFTY' | 'BANKNIFTY'. Not an enum: SEBI has changed the eligible set before.
  symbol text not null,
  expiry date not null,
  -- Trading day this snapshot describes, in IST.
  captured date not null,
  -- Index level at capture. Load-bearing: without it a stored chain cannot be repriced.
  underlying numeric,
  -- NSE's own timestamp string, kept raw because its format is not ISO.
  quoted_at text,
  -- Compacted strikes: [{ k, ce: {p, iv, oi, b, a}, pe: {...} }, ...]
  chain jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, symbol, expiry, captured)
);

-- The backtester reads forward through time for one underlying, so this is the index
-- that matters. The primary key alone would force a scan for "every day of this symbol".
create index if not exists gth_option_chains_by_day
  on public.gth_option_chains (user_id, symbol, captured);

alter table public.gth_option_chains enable row level security;
drop policy if exists gth_option_chains_owner on public.gth_option_chains;
create policy gth_option_chains_owner on public.gth_option_chains
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Note: written by the service-role key from the cron route (single super-admin), so it
-- is not gated by auth.uid(); the policy above still protects direct client access.
