# GlobalTrade Hub

Multi-asset trading terminal (crypto, India equity, US equity, forex, commodities) with a
persistent paper-trading engine, backtester, scanner, and LLM-backed trading agents.

## Repo layout

The Next.js app lives in **`app/`**, not the repo root. Run every npm command from there.

```
app/            Next.js 16 App Router application
docs/           ARCHITECTURE.md, DOCUMENTATION.md, PROVIDERS.md, AUDIT.md
supabase/       migrations (gth_* tables, RLS)
```

```bash
nvm use          # Node 22+. @supabase/supabase-js declares engines >=22.0.0 and warns below it.
cd app
npm install
npm run dev     # http://localhost:3000 → redirects to /terminal
npm run build
npm run lint
npm test        # vitest — pure modules only (paperEngine, backtestEngine, scanner, coach)
```

## Stack

Next.js 16.1 (App Router, Turbopack) · React 19 · TypeScript 5 · Tailwind **v4** (CSS-first
`@theme`, no `tailwind.config.js`) · Zustand **5** (persisted) · Supabase (Postgres + Vault) ·
custom SVG charts in `src/components/charts`.

## Architecture notes that aren't obvious from the tree

- **Auth is a single env super-admin, not Supabase Auth.** `ADMIN_EMAIL` + `ADMIN_PASSWORD` +
  `AUTH_SECRET` in `.env.local`; `src/lib/auth.ts` signs an HMAC session cookie. `auth.users` is
  empty by design — do not add foreign keys to it. All rows key off `ADMIN_USER_ID`.
  `src/lib/auth.ts` is imported by `src/middleware.ts`, which runs on **edge**: Web Crypto only,
  no Node built-ins.
- **Page routes are gated by middleware; API routes self-guard** via `requireAdmin(req)`. If you
  add an API route, add the guard — the middleware matcher deliberately excludes `/api`.
- **Broker secrets never reach the browser.** Credentials are POSTed to the server and stored in
  Supabase Vault (via `SECURITY DEFINER` wrappers in `public` — the `vault` schema is not
  reachable from `supabase-js`). Vault secret names are **derived server-side**; never take a
  secret name from a request body.
- **Two persistence layers.** Zustand `persist` → localStorage (`gth-paper`, `gth-agents`,
  `gth-coach`, `gth-connections`, `gth-ui`), mirrored to Supabase `gth_app_state` by
  `src/lib/cloudSync.ts`. Any change to a persisted store's shape needs a `version` + `migrate`
  **and** a matching validator in `cloudSync`, or existing users hydrate into `NaN`.
- **`MarketEngine`** (mounted once in the shell) drives the price feed, matches resting paper
  orders every second, and samples the equity curve. **`AgentEngine`** runs the auto-trading loop.

## Money and market data

- Base currency is **INR**. Every instrument has a quote currency; convert with the shared
  `toBase()` helper in `src/lib/paperEngine.ts`. Never assume USD — `USD/JPY` is JPY-quoted.
- The paper ledger must satisfy this identity; there is a test and a dev-time assertion for it:
  ```
  cash + reservedCash + Σ marginHeld + Σ_longs(costBasis)
    === startingCash + realizedGross − feesPaid
  ```
- Crypto prices come from a real Binance WebSocket (on by default; `NEXT_PUBLIC_ENABLE_BINANCE_FEED=false`
  to disable). FX/commodities come from Twelve Data via `/api/marketdata` — **free tier is 8 req/min,
  800/day, so cache before wiring anything new to it.** Everything else is simulated.
- The matching engine must stay **deterministic** — it feeds a persisted, cloud-synced store, and
  two devices replaying the same state must agree. Use the seeded PRNG, never `Math.random()`.

## Styling — read this before touching CSS

**Never add a bare `* { margin: 0; padding: 0 }` to `globals.css`.** Tailwind emits every
utility inside `@layer utilities`, and unlayered declarations beat layered ones in the cascade,
so such a rule silently nullifies **every** `p-*` and `m-*` class in the app — 305 of them, across
16 files. That bug shipped once and was only visible as "the UI looks distorted"; it also caused
~120 inline `style={{padding: 18}}` workarounds, because inline styles were the only padding that
still rendered. Tailwind's Preflight already resets margin/padding/box-sizing inside `@layer base`.

`npm run lint:spacing` fails the build if inline padding/margin reappears in `src/**/*.tsx`.
`app/global-error.tsx` is exempt on purpose — it renders when the root layout has failed, so it
cannot depend on CSS vars or Tailwind being available.

Scales live in `globals.css` and are deliberately small: **9 type sizes** (use `text-2xs` … `text-3xl`,
never `text-[13.5px]`), **4 radii**, **4 elevation steps** (`shadow-elev-1`…`3`), **4 font weights**
(700 is for page titles and hero numbers only). Colour comes from tokens — never hardcode a hex or
`rgba()`, because the light and dark palettes differ and literals only ever match one of them.
Light-theme text tokens are tuned to pass WCAG AA against `--panel`; keep them there.

Segmented controls signal selection through **border + elevation**, not fill contrast — a
`bg-panel` thumb on a `bg-chip` track is 1.20:1 in light and invisible on fill alone.

## Component kit

`src/components/ui/` is the only place UI primitives live: `Button`, `IconButton`, `Panel`,
`Badge`, `Callout`, `StatTile`, `EmptyState`, `Field`/`Input`/`Select`/`NumberInput`, `DataTable`,
`SegmentedControl`, `Tabs`, `Sheet`, `ConfirmDialog`, `PnlText`/`PriceText`/`MarketBadge`, and
`PageShell`. Build from these rather than hand-rolling — `DataTable` alone replaced six independent
CSS-grid tables that each duplicated their column template in header and rows.

Pages use `PageShell` (`wide` | `narrow` | `full`) so gutters, max-width and the header are uniform.

## Market data

`src/lib/marketData/` — providers behind a router with fall-through, everything going through
`cachedFetch` (TTL + single-flight + token bucket + circuit breaker). **Never call a provider
directly**; the free tiers are small and Yahoo will IP-block on abuse (its *search* endpoint is far
more aggressively throttled than its chart endpoint, so search has a hard 8/min budget and an
exact-ticker fallback).

`USD/INR` is load-bearing: `deriveFxRates()` prices the whole ₹ book from it. It comes live from
Yahoo with frankfurter.app as backup. The fallback constant is documented in `paperEngine.ts` and
must be refreshed if it drifts — it was 83.2 against a real 95.3, a 14.5% mispricing.

See `docs/MARKET-DATA.md` for the per-market provider table and what each key is worth.

## Learn

`src/lib/learn/curriculum.ts` holds the lessons; `verify.ts` holds pure predicates that check
**persisted engine state**. An exercise must never be completable by clicking "done" — that is the
whole point, and it is what keeps the curriculum honest against the ledger.

## Conventions

- 4-space indent, single quotes, no semicolon-free style — match the file you're editing.
- Server-only modules start with `import 'server-only'` (see `src/lib/ai/`, `src/lib/notify/`).
- LLM calls go through `runLLM()` in `src/lib/ai/index.ts`, which resolves provider from
  arg → `LLM_PROVIDER` → `deepseek` and falls back across configured keys. **DeepSeek is the
  default**, not Anthropic — don't hardcode a vendor or reference `ANTHROPIC_API_KEY` in user copy.

## The one rule that matters most

**Never describe a mocked, stubbed, or unimplemented feature as working** — not in UI copy, not in
docs, not in commit messages, not in an API response. This codebase accumulated a large backlog of
defects precisely this way: a "connected" badge for credentials that were discarded, "enforced on
your paper & live order tickets" for a check that live mode skipped, "live" labels on constants,
and fabricated numbers rendered beside real ones.

If something isn't built, say so in the surface the user actually sees. Prefer an honest empty
state or an explicit "not implemented" over a plausible-looking placeholder.

See `docs/AUDIT.md` for the tracked remediation backlog and the modeling decisions behind the
paper-engine and backtest numbers.
