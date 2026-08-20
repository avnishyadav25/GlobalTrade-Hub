# GlobalTrade Hub — Architecture


> **Staleness warning.** This document predates the options layer, walk-forward and
> portfolio backtesting, and the current provider set. See [PENDING.md](PENDING.md) for
> what is actually true today.

Multi-asset trading terminal: crypto, Indian equity, US equity, forex and commodities, with a
persistent paper-trading engine, a backtester, a market scanner and LLM-backed agents.

> This document describes the app **as it is**. An earlier version of this file described a
> Next.js 14 app with a sidebar, `/markets`, `/orders`, `/risk` and a `tradingStore` — none of
> which exist. See [AUDIT.md](./AUDIT.md) for the defect backlog and modelling decisions.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js **16.3** (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | React **19**, Tailwind **v4** (CSS-first `@theme`, no `tailwind.config.js`) |
| State | Zustand **5** with `persist` |
| Charts | Hand-rolled SVG in `src/components/charts` |
| Backend | Supabase (Postgres + Vault), optional |
| Tests | Vitest over the pure domain modules |

Runtime dependencies are deliberately few: `@supabase/supabase-js`, `lucide-react`, `next`,
`next-themes`, `react`, `react-dom`, `sonner`, `zustand`.

---

## Layout

The app lives in **`app/`**, not the repo root.

```
app/src/
├── proxy.ts               # auth gate for all page routes (edge)
├── app/
│   ├── terminal|backtest|paper|portfolio|insights|scanner|agents|settings/
│   ├── auth/login|signup/
│   ├── api/
│   │   ├── auth/login/            # session cookie
│   │   ├── agents/[agent]/        # signals · journal · briefing · scanner
│   │   ├── brokers/connect/       # verify + Vault store + list/delete
│   │   ├── brokers/[broker]/order/# live routing (gated)
│   │   ├── coach/                 # LLM coach
│   │   ├── marketdata/            # FX/commodity quotes
│   │   ├── marketdata/candles/    # historical OHLCV
│   │   ├── notify/  state/[key]/  cron/tick/
│   ├── error.tsx · loading.tsx · not-found.tsx · global-error.tsx
├── components/
│   ├── charts/     terminal/     layout/     system/     ui/sonner.tsx
├── lib/
│   ├── paperEngine.ts      # matching engine + ledger  (unit-tested)
│   ├── backtestEngine.ts   # strategy backtester       (unit-tested)
│   ├── scanner.ts  coach.ts  agentGuardrails.ts        (unit-tested)
│   ├── ai/         brokers/registry.ts + brokers/server/*
│   ├── marketData/binance.ts   notify/   supabase/   cloudSync.ts
└── stores/         market · series · paper · ui · coach · agent
```

---

## Authentication

A single **env super-admin**, not Supabase Auth.

```
ADMIN_EMAIL + ADMIN_PASSWORD + AUTH_SECRET   →  HMAC-signed httpOnly cookie
```

All three or none. A partial configuration is `misconfigured` and fails **closed** with a 503
rather than silently running open. There is no fallback secret.

`auth.users` is empty by design — **do not add foreign keys to it** (migration `0003` drops the
one that blocked broker connections). All rows key off `ADMIN_USER_ID`.

- **Page routes** are gated by `src/proxy.ts` (the `proxy` file convention; `middleware` is
  deprecated in Next 16). It runs on **edge**, so `lib/auth.ts` must stay Web-Crypto-only.
- **API routes self-guard** with `requireAdmin(req)` — the proxy matcher deliberately excludes
  `/api`. If you add a route, add the guard.

---

## Money: the currency model and the ledger

Base currency is **INR**. Every instrument declares its own `quoteCcy` in `mockData.ts`, which is
**not** implied by its market — `USD/JPY` sits in the forex market but is quoted in JPY. All
conversion goes through one helper:

```ts
toBase(symbol, amountInQuoteCcy, fx)   // fx from deriveFxRates(quotes)
```

`deriveFxRates` uses a live `USD/INR` quote where the provider supplies one and derives JPY from
the live `USD/JPY`; otherwise it falls back to a documented constant and sets `stale: true`, which
the UI surfaces rather than hiding.

### The ledger

`PaperState` carries running aggregates on the account (`realizedGross`, `feesPaid`, `roundTrips`)
rather than deriving them from the capped `fills` array. Position cost is frozen into `basisBase`
at fill-time FX, so a later currency move is unrealized until close.

Opening a **short** moves `basisBase × SHORT_MARGIN_FACTOR` from cash into `marginHeldBase`; it
does not credit the proceeds. Resting orders reserve cash in `reservedCash` (a soft hold — cash
itself is not debited), so `buyingPower = cash − reservedCash`.

The engine maintains this identity at all times, asserted in tests and in a dev-time check:

```
cash + Σ marginHeldBase + Σ_longs(basisBase) === startingCash + realizedGross − feesPaid
```

The matching engine is **deterministic**: no `Math.random()`, no `Date.now()` in the matching
path. Partial fills come from a seeded PRNG keyed on `(orderId, filledQty, seq)`, and ids come
from a persisted monotonic `seq`. This matters because the state is persisted *and* cloud-synced —
two devices replaying the same inputs must agree.

### One chokepoint for orders

`usePaperStore.place()` is the only way an order reaches the engine. Kill-switch, coach rules and
engine validation all run there, so the order ticket, the Agents screen and the auto-trading loop
are enforced identically. It returns `{status, orderId, reason?}`; callers surface the reason.

---

## Market data

| Instruments | Live source | Fallback |
|---|---|---|
| BTC/ETH/SOL | Binance public WebSocket (no key) | simulation |
| FX & commodities | Twelve Data via `/api/marketdata` | simulation |
| Indian & US equity | — | simulation |

`NEXT_PUBLIC_ENABLE_BINANCE_FEED=false` forces pure simulation. The header badge reads **LIVE** or
**SIM** from `marketStore.usingRealFeed` — it is not decorative.

Every quote funnels through `marketStore.applyQuote`, which also feeds **`seriesStore`**: a
non-persisted ring buffer of 1-minute bars (~25h) used for real RSI and a real rolling 24h
high/low. Indicators return `null` while warming up, and the scanner **excludes** rows with
unknown metrics rather than assuming a neutral value.

**Twelve Data's free tier is 8 req/min and 800/day** — cache before adding callers.

### Historical candles

`/api/marketdata/candles` fans out: Binance klines (free) → Alpaca (your keys) → Twelve Data
(cached 5 min) → **labelled synthetic**. When no provider covers a symbol the backtest screen says
*"This is not a historical backtest"* in the UI. The synthetic generator is driftless GBM; the
previous one hardcoded +0.08%/bar, so a long-only strategy essentially could not lose.

---

## Brokers

Registry (`lib/brokers/registry.ts`) drives the Settings UI. Server connectors live in
`lib/brokers/server/` and are **stateless** — credentials are passed per call, because serverless
invocations share no memory.

| Broker | verify | Order routing |
|---|---|---|
| Alpaca | `GET /v2/account` | implemented (US equity) |
| Binance | signed `GET /api/v3/account` | implemented (BTC/ETH/SOL) |
| Dhan | `GET /v2/fundlimit` | not implemented (needs the instrument master for `securityId`) |
| Zerodha · Coinbase · IBKR | — | no connector; `/connect` returns 501 |

`POST /api/brokers/connect` **authenticates against the venue first** and only stores credentials
on success. Failure returns `error` and records `last_error` — it never produces a green badge.

Credentials go to **Supabase Vault** via `SECURITY DEFINER` wrappers in `public` (the `vault`
schema is not reachable through PostgREST), with `EXECUTE` granted only to `service_role`.

> **Security invariant:** the Vault secret name is derived server-side as
> `gth:{ADMIN_USER_ID}:{broker}:{mode}`. It must never come from a request body — the wrappers can
> read any secret by name, so an attacker-supplied name would be an arbitrary-secret-read primitive.

Live routing requires **both** an explicit `mode:'live'` and `ENABLE_LIVE_TRADING=true`. Callers
that omit a mode default to paper. Binance paper targets the Spot Testnet, which uses **separate
keys** from mainnet.

---

## Persistence

Two layers:

1. **localStorage** via Zustand `persist` — `gth-paper`, `gth-agents`, `gth-coach`, `gth-ui`,
   `gth-strategies`, `gth-signals`, `gth-learn`, `gth-watchlists`, `gth-alerts`.
2. **Supabase `gth_app_state`** via `lib/cloudSync.ts`, hydrating concurrently on load and
   debounce-persisting changes.

Server JSON is untrusted: every sync entry declares a `validate` guard, and a row that fails it is
skipped with a console warning rather than written into the store.

`cloudSync` **subscribes before it hydrates**. It used to attach its subscribers only after the
hydration fetch resolved, leaving a window in which a setting the user changed was written to
localStorage and never sent to the server at all — the next reload then hydrated the older row over
it. Hydration also skips any store the user touched while it was loading, or the fix would send the
change and then immediately overwrite it locally.

Every order records **what placed it** (`source`: manual, strategy, agent or settlement), which is
what lets `/orders` show provenance and lets a lesson be gated on a strategy having actually
traded.

> Changing a persisted store's shape requires a `version` + `migrate` **and** a matching validator,
> or existing users hydrate into `NaN`. `PaperState` is at version 2; v1 blobs are reset with a
> user-facing notice because their P&L was computed under the old currency bug and cannot be
> recomputed.

Broker connections are **not** cloud-synced — they live in `gth_broker_connections`, keyed to
Vault secrets.

---

## AI

`runLLM()` in `lib/ai/index.ts` resolves the provider from argument → `LLM_PROVIDER` → `deepseek`,
falling back across whichever keys are configured, and returns `null` when none are — callers then
use a heuristic path. **DeepSeek is the default**; don't hardcode a vendor in user-facing copy.

Agents (`/api/agents/[agent]`): trading signals, journal writer, daily briefing, NL→scan criteria.
The auto-trading loop (`components/system/AgentEngine.tsx`) shares its guardrails with the manual
path via `lib/agentGuardrails.ts`. A failed live order **skips the signal** — it never substitutes
a paper order for a real one.

`killSwitch` and `autoActedIds` persist; `liveArmed` deliberately does not, so arming real-money
trading is a per-session decision.

---

## Background work

`MarketEngine` (mounted once) drives the feed, matches resting orders every second and samples the
equity curve. `AgentEngine` runs the LLM auto-trading loop on a 60s cycle. `StrategyEngine` runs the
deterministic one, evaluating enabled instances against the **same candle endpoint the backtester
uses** — anything else would make a backtest unable to say anything about live behaviour.
`CloudSync` hydrates and persists. `/api/cron/tick` produces the daily briefing and snapshots the
NIFTY/BANKNIFTY option chains.

---

## Automation

Strategies can run with no browser open, via `/api/automation/run` driven by a self-hosted
scheduler (`scripts/scheduler.sh`). Vercel Cron is not used: the Hobby tier allows one run a day.

**Only one runner may act at a time**, because the paper ledger cannot survive two writers. The
monotonicity guard in `api/state/[key]` rejects a write with an older `seq`, but an EQUAL seq
passes — so a tab and a runner both starting from seq 100 can each place an order, each write 101,
and one order vanishes while both books still balance perfectly. Nothing looks broken.

Two mechanisms make that impossible rather than unlikely:

- **A lease.** The browser posts a heartbeat every 45s while it has instances to evaluate; the
  runner stands down if one landed within 3 minutes. The browser always wins — if a tab is open it
  is already doing the work.
- **A compare-and-set write.** The runner reads `seq` at the start and writes back only if the row
  still carries it. A tab can open *mid-run*, so the lease alone is not enough.

A third, narrower duplicate is possible across a *handover* rather than concurrently: signal ids are
deterministic (`strategyId:symbol:barTime:action`), and runtime memory is never persisted, so a
runner starting fresh would re-place an order the other just made. The lease therefore also carries
the acted-on signal ids.

The lease lives in **two rows** — `automation` (browser) and `automation-server` (runner) — each
replaced wholesale by its owner. One shared row meant read-modify-write from two writers, and it
lost `serverRanAt` and the acted-id list within hours of being built.

Everything risk-bearing is shared with the browser loop through `lib/automation/decide.ts`. Only
the commit differs: the browser goes through `usePaperStore.place()`, the runner calls `placeOrder()`
against a book read from Supabase.

The runner refuses to trade on stale FX, on generated candles, on a `review`-mode instance, or with
the kill switch on. `/automation` reports what is running, derived from a real check-in rather than
from a setting — a scheduler on a sleeping laptop is not running.

---

## Testing

```bash
cd app && npm test
```

661 unit tests over the pure modules, plus an end-to-end suite in `app/e2e/` run via
`scripts/e2e.mjs`. Note that `npm run test:e2e` still does **not** work: `@playwright/test` has
never installed on this machine, so the suite runs on a separately-supplied Playwright. They encode the invariants that
are easy to regress: the ledger identity, currency conversion, buying power, determinism,
indicator warm-up, look-ahead bias, and order-independence of the coach rules.
