# GlobalTrade Hub — defect audit and remediation backlog

Audit date: **2026-08-10**. Covers every screen, every store, every engine, and every API route.
**92 fixed, 5 partial, 1 open.** Status legend: `[ ]` open · `[x]` fixed · `[~]` partially fixed · `[wontfix]` accepted.

Stage numbers refer to the remediation sequence at the bottom of this file.

---

## S15 — Feature expansion ✅ (2026-08-10, third pass)

Six new screens, a component kit, a real market-data layer and a learning track. New findings
from this pass, all fixed:

| # | Status | Finding |
|---|---|---|
| S15.1 | `[x]` | **USD/INR fallback was 83.2 against a real ~95.3** — a **14.5% mispricing of every USD-quoted position**, since the base currency is INR. Now live from Yahoo (`USDINR=X`) with frankfurter.app as a keyless backup and a last-known-good cache. |
| S15.2 | `[x]` | Three provider assumptions in the plan were **wrong when tested live**: `exchangerate.host` now requires a key; the Twelve Data key returns **401** (33 hex chars, theirs are 32); Finnhub's free tier **403s** on forex and Indian tickers. Yahoo turned out to cover the entire universe keylessly, so it became the universal fallback and Twelve Data was dropped. |
| S15.3 | `[x]` | Ledger released short margin at the **exit** notional instead of the **entry** basis — off by ₹4,111 on a single round trip. It now reconstructs position state as it walks, mirroring the engine. |
| S15.4 | `[x]` | Sorting fills by `ts` alone is unsafe: two fills can share a millisecond, and the stable sort then preserved the store's newest-first order, so the ledger read a **close before its own open** and booked it as a short. Now tie-breaks on the engine's monotonic `seq`. Regression test included. |
| S15.5 | `[x]` | `useWatchlistStore((s) => s.allSymbols())` returned a fresh array per render — `useSyncExternalStore` saw a changed snapshot every time and `/alerts` **infinite-looped**. Select raw state, derive with `useMemo`. |
| S15.6 | `[x]` | Circular import: `instruments.ts` read `WATCHLIST_ASSETS` at module scope while `mockData.ts` was still initialising (TDZ). Registry is now lazily seeded on first access. |
| S15.7 | `[x]` | Yahoo's **search** endpoint 429'd during testing while the chart endpoint stayed healthy. Search now has its own 8/min budget, a 10-minute cache, a circuit breaker, an **exact-ticker fallback** via the chart endpoint, and an honest "rate-limited" message instead of "no results". |
| S15.8 | `[x]` | Learn's lesson page called `complete()` during render, updating another component mid-render. Moved into an effect. |

**Verified live — 22/22 checks**: all 13 screens render error-free; a kill-switch rejection appears
in Orders with its reason; the Funds ledger reconciles to cash (`balanced — ₹0.00`); Holdings shows
the real position; instrument search resolves NSE/US/crypto tickers with the correct market and
currency; Learn auto-detects a completed exercise from real fills.

**Note on the kill-switch**: it is cloud-synced and hydration uses `local || server`, so it is
deliberately **fail-safe** — a server `true` can never be cleared by a stale local `false`. Clear it
through the Agents screen, which writes `false` to the server.

## S14 — UI / design system ✅ complete (2026-08-10, second pass)

| # | Status | Defect |
|---|---|---|
| S14.1 | `[x]` | **ROOT CAUSE of the "distorted UI".** `globals.css:166` had an unlayered `* { margin:0; padding:0 }`. Tailwind emits utilities inside `@layer utilities`, and unlayered CSS beats layered CSS, so **all 305 `p-*`/`m-*` classes across 16 files computed to zero** — and it was redundant with Preflight. It also explains the ~120 inline `style={{padding:18}}` workarounds. → Deleted; `npm run lint:spacing` now gates its return. **Verified in the compiled bundle and in the browser (nav 14px, buttons 12px).** |
| S14.2 | `[x]` | Light theme failed WCAG AA across the board and had no surface hierarchy. → Repalette. **Measured: `--faint` 2.55→4.68, `--up` 3.39→5.16, `--down` 4.07→5.62, `--warn` 3.64→5.79; border 1.23→1.42, chip 1.12→1.20. `up`/`down`/`accent` also pass ≥4.5 for white-on-fill.** Dark's two failures fixed too (`--faint` 3.22→5.16, `--border` 1.16→1.32). |
| S14.3 | `[x]` | `.panel` had no elevation, so a white panel on a near-white page was invisible regardless of border. → `box-shadow: var(--elev-1)`, 4-step theme-aware elevation scale. |
| S14.4 | `[x]` | Segmented toggles were invisible when selected (`bg-panel` on `bg-chip` = 1.12:1). → Selection now reads via **border + elevation** against a darker track, with `role="radiogroup"`/`aria-checked`. Applies to terminal paper/live, agents mode, settings MODE and theme. |
| S14.5 | `[x]` | 22 distinct font sizes / 189 arbitrary `text-[Npx]`; `font-extrabold` at 47 sites flattening all hierarchy. → **9-step type scale** (redefining Tailwind's own `--text-*` so `text-sm`/`base`/`lg`/`xl` retarget for free), 4 weights, 4 radii. Zero arbitrary sizes remain. |
| S14.6 | `[x]` | 5 disagreeing page shells (4× maxWidth 1180, settings 900, 3 full-bleed; 3 bottom paddings; 2 gutters). → One `PageShell` with `wide`/`narrow`/`full`, a standard header, and a `coachTopic` slot for the Learn work. |
| S14.7 | `[x]` | "Refresh with AI" clipped at the container edge — no gap, no `shrink-0`, and dead padding. → Fixed by `PageShell`'s header. **Verified: right edge 1296 of 1440.** |
| S14.8 | `[x]` | `hover:border-border-hover` compiled to nothing (`--color-border-hover` was never exported in `@theme`). → Exported. |
| S14.9 | `[x]` | ~12 files hardcoded dark-palette `rgba()`/hex that never adapted to light (insights sev/mood chips, OrderTicket glow, TopBar LIVE badge, portfolio `MARKET_COLORS`). → All routed through tokens. `global-error.tsx` keeps literals **on purpose** — it renders when the layout has failed. |
| S14.10 | `[x]` | **Synthetic candle volatility** (regression from S10): `0.012 * √(seconds/900)` = **11.8% per bar at 1D**, so RELIANCE (~2,944) drew a 1,217→8,699 axis. → Annualised per market and scaled by *session* seconds. **Verified: 1D RELIANCE now 2,779→3,523, a 25% band.** |
| S14.11 | `[x]` | Chart axis labels used `Math.round()`, so every EUR/USD gridline rendered "1". → `fmtPrice`. |
| S14.12 | `[~]` | 40 of 59 interactive elements had no hover and no focus state; 13 inputs used `outline-none` with no replacement. → A single global `:focus-visible` outline in `@layer base` (not a ring, so it survives `overflow-hidden`), plus `.field:focus-within`. Per-component hover/active states land with the component kit. |

**Verified live**: padding present on nav and controls; `.panel` elevated; no horizontal overflow at
1920/1440/1280/1024/768/390; order ticket reachable at every width; no page errors.

## S1 — Security ✅ complete

| # | Status | Defect | Location |
|---|---|---|---|
| S1.1 | `[x]` | `secret()` fell back to the hardcoded `'gth-dev-secret-change-me'` while `isAuthConfigured()` checked only `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Setting those two without `AUTH_SECRET` turned the gate on while sessions stayed forgeable with a public constant. **Demonstrated live**: a cookie signed with the default secret returned 200 on `/settings`. → Fallback removed; auth is now all-or-none via `authConfigStatus()`, and a partial config fails **closed** with a 503. Regression test in `auth.test.ts`. | `app/src/lib/auth.ts` |
| S1.2 | `[x]` | Session HMAC compared with `!==` — not constant-time. → `timingSafeEqual()` compares SHA-256 digests, so the loop count is input-independent and no length is leaked. Applied to the password compare too. | `app/src/lib/auth.ts` |
| S1.3 | `[x]` | `/api/notify` had no `requireAdmin` on either verb — `POST` was an open message-sending endpoint into the owner's Telegram/Resend/Twilio. | `app/src/app/api/notify/route.ts` |
| S1.4 | `[x]` | `/api/coach` had no `requireAdmin` — an unauthenticated endpoint billing the owner's LLM key. | `app/src/app/api/coach/route.ts` |
| S1.5 | `[x]` | `/api/marketdata` had no `requireAdmin` — burned the Twelve Data quota. | `app/src/app/api/marketdata/route.ts` |
| S1.6 | `[x]` | `/api/brokers/connect` had no `requireAdmin` — and it is the route that *receives broker credentials*. | `app/src/app/api/brokers/connect/route.ts` |
| S1.7 | `[x]` | `/api/cron/tick` returned `true` when `CRON_SECRET` was unset. → Open in dev only; fails closed in production. | `app/src/app/api/cron/tick/route.ts` |
| S1.8 | `[x]` | Open redirect via the `next` param. → `safeNextPath()` accepts same-origin paths only, rejecting absolute, protocol-relative and backslash forms. Applied on both the read (login page) and write (proxy) side. | `app/src/lib/auth.ts`, `auth/login/page.tsx`, `proxy.ts` |
| S1.9 | `[x]` | `next` 16.1.1 carried multiple **middleware/proxy-bypass** advisories, which mattered unusually here because middleware *is* the auth gate. → Upgraded to **16.3.0**; `next` is no longer flagged by `npm audit` (11 → 6 vulns, all remaining in the dev-only eslint chain). Also migrated `middleware.ts` → `proxy.ts` via the official `@next/codemod middleware-to-proxy`, clearing the deprecation. | `app/package.json`, `app/src/proxy.ts` |
| S1.10 | `[~]` | `logout()` did not clear localStorage. → Now clears `gth-connections` (which asserts broker linkage). **Deliberately keeps** paper history, agent settings and preferences: this is a single-admin app, and clearing them would destroy trade history that may not be mirrored to Supabase. | `app/src/app/settings/page.tsx` |

**Verified live**: unauthenticated → 401 on all four routes and a 307 to `/auth/login` on pages; wrong
credentials → 401; correct credentials → 200 and a working session; all 8 screens render logged in;
the in-page `/api/marketdata` poll still returns 200. A cookie forged with the old default secret is
now rejected (307 to login) where it previously returned 200.

## S2/S3 — Paper engine (`app/src/lib/paperEngine.ts`) ✅ complete

Rewritten around a quote-currency model and a reconciling ledger. 26 unit tests in
`paperEngine.test.ts` cover the identity, currency conversion, buying power, resting-order
reservation, determinism and aggregate exactness.

| # | Status | Defect |
|---|---|---|
| S2.1 | `[x]` | **`fxRate()` returns `USDINR` for every non-India instrument.** `USD/JPY` is JPY-quoted, so 1 unit @158.80 is valued at ₹13,212 instead of ~₹83 — **off by ~159×**. Live today: real FX now flows from `/api/marketdata`. (`:80-83`) → Replaced with a per-instrument quote-currency model (`quoteCcy` on every asset + `toBase()`); `deriveFxRates` uses live USD/INR and derives JPY. **Verified: 1 unit of USD/JPY now values at ₹83.20, was ₹13,212.** |
| S2.2 | `[x]` | **Opening a short credits full notional cash** with no margin held, so shorting *increases* buying power. Combined with S2.4, an unbounded money loop. (`:191`) → A short now moves `basisBase * SHORT_MARGIN_FACTOR` from cash into `marginHeldBase` instead of crediting proceeds. Test asserts buying power *falls* when shorting. |
| S2.3 | `[x]` | **`realizedTotal` is gross of fees while `cash` is net.** The two drift apart by the cumulative fee total and can never reconcile. (`:191` vs `:206,348`) → `realizedGross`/`feesPaid`/`realizedNet` are separate named selectors; `realizedNet` is the one that reconciles with cash. |
| S2.4 | `[x]` | No buying-power, margin, or quantity validation. `'rejected'` is declared in the status union and never assigned. Cash goes arbitrarily negative. (`:12,237-262`) → Full validation with an assigned `rejected` status and `rejectReason`; buying-power, quantity, fractionality and trigger-price checks. |
| S2.5 | `[x]` | **Fills array capped at 300**, but `realizedTotal`/`winRate`/coach/agent-guardrails all reduce over it — so past 300 fills, realized P&L starts *decreasing* as old fills fall off. (`:224,348,351`) → Aggregates are running counters on the account. Test asserts exactness past 640 fills. |
| S2.6 | `[x]` | Going flat deletes the position record, discarding its accumulated `realizedPnl` permanently. (`:173`) → `realizedBySymbol` retains per-symbol P&L after a position goes flat. |
| S2.7 | `[x]` | `Math.random()` inside the matching engine, whose header claims determinism — and the result is written to a **persisted, cloud-synced** store, so two devices diverge. (`:4,313`) → Seeded `mulberry32` keyed on `(orderId, filledQty, seq)`. Test asserts byte-identical state across runs. |
| S2.8 | `[x]` | Partial fills never engage for fractional instruments: the unit floor equals the whole remainder, so crypto always fills 100%. (`:314`) → Fractional instruments now fill a true fraction; whole-unit instruments floor to ≥1 unit. |
| S2.9 | `[x]` | A market order placed with no quote rests forever — `processTick` has no `'market'` branch, making the `o.type === 'market'` reference at `:314` unreachable. Reachable via an agent hallucinating an unknown symbol. (`:257,290-309`) → `processTick` has a `market` branch; unknown symbols are rejected at placement instead of resting. |
| S2.10 | `[x]` | Limit fills take **zero slippage** while market/stop pay 3 bps, and the `Math.min`/`Math.max` "price improvement" is a no-op. Systematically flatters limit strategies. (`:285,292-293`) → Limits fill AT the limit price with a maker fee; market/stop pay taker fee + 3bps slippage. |
| S2.11 | `[x]` | `fillQty === 0` divides by zero → `NaN` `avgFillPrice`, which then renders in `PositionsPanel`. (`:195`) → `fillOrder` guards `fillQty > 1e-8` and a finite, positive price. |
| S2.12 | `[x]` | `uid()` uses a module-level `_seq` that resets on reload plus millisecond `Date.now()` — IDs collide across reloads, so `cancelOrder` can cancel the wrong persisted order. (`:114-118`) → Ids come from a persisted monotonic `seq`, so they cannot collide across reloads. |
| S2.13 | `[x]` | `winRate` counts fills, not round-trips: one order filled in 4 partials counts as 4 trades. `/paper` separately renders `fills.length` as "TRADES", so two numbers on one screen disagree. (`:351` / `app/paper/page.tsx:36`) → Win rate is over round trips; `/paper` renders `account.roundTrips` as TRADES so both numbers agree. |
| S2.14 | `[x]` | Orders missing their trigger price (`limit` with no `limitPrice`) rest forever, unfillable and never expiring. (`:291,296`) → Rejected at placement with a reason. |
| S2.15 | `[x]` | Rounding at `:212`/`:316` can push `filledQty` past `qty`; `status` uses a different epsilon than the `remaining` guard, so an order can be marked `'filled'` with quantity outstanding. (`:212,215,283`) → Consistent `round8` and a single epsilon for remaining/complete. |

## S4 — Persisted state ✅ complete

| # | Status | Defect |
|---|---|---|
| S4.5 | `[x]` | **Found during Module 1 testing.** Cloud-sync writes are debounced 1.5s, so navigating right after an order remounted the app and re-hydrated a server row that predated the trade — **silently discarding it** (`seq 2 → 0`, cash ₹4,79,349 → ₹5,00,000). → Hydration now refuses server state that is not newer than local (compared on the engine's monotonic `seq`), pending writes are flushed with `keepalive: true` on unmount, and a locally-engaged kill-switch can never be switched off by a server row. **Verified: the trade now survives a fast navigation.** |


| # | Status | Defect |
|---|---|---|
| S4.1 | `[x]` | `usePaperStore` persists with no `version`/`migrate`. Any shape change hydrates `undefined` into new fields and cascades `NaN` through equity, charts and the coach. (`app/src/stores/paperStore.ts:50`) → `version` + `migrate` on the store; v1 blobs reset with a user-facing notice. |
| S4.2 | `[x]` | `cloudSync` does a blind `e.store.setState(data.value)` on arbitrary server JSON with no shape validation. A malformed row replaces `paperStore.state` wholesale; the next render throws with no error boundary. (`app/src/lib/cloudSync.ts:48`) → Every cloudSync entry declares a `validate` guard; `isPaperState` rejects wrong-version or non-finite blobs. |
| S4.3 | `[~]` | Five `as unknown as AnyStore` casts erase all type safety between the stores and the sync layer; a renamed field breaks sync silently at runtime. (`app/src/lib/cloudSync.ts:27-31`) |
| S4.4 | `[x]` | Hydration is a sequential `await` loop with no loading state — the UI renders local data, then jumps. A `configured:false` mid-loop aborts the rest, leaving partial hydration. (`app/src/lib/cloudSync.ts:43-52`) → Hydration is concurrent, and a fully-unconfigured server leaves localStorage untouched rather than partially applying. |

## S5 — Rule enforcement and kill-switch (partial — agent guardrails S5.5–S5.8 still open)

| # | Status | Defect |
|---|---|---|
| S5.1 | `[x]` | `checkRules` is called from **exactly one place**, and three paths bypass it: live mode returns early *before* it (`OrderTicket.tsx:38` vs `:44`), `applySignal` calls `place()` directly (`agents/page.tsx:85`), and the auto loop calls `place()` directly (`AgentEngine.tsx:99`). The Insights copy claims rules are "enforced on your paper & live order tickets". → Kill-switch + `checkRules` + validation moved into `usePaperStore.place()`, the single chokepoint all three paths use. |
| S5.2 | `[x]` | **`killSwitch` is not persisted** while `mode` and `liveArmed` are. Kill-switch → close tab → reopen resumes auto-trading 60s later with no interaction. (`app/src/stores/agentStore.ts:65`) → `killSwitch` and `autoActedIds` now persist; `liveArmed` deliberately does not, and `merge` never restores an armed state. |
| S5.3 | `[x]` | The kill-switch only gates the background loop. Manual Run, `Trade →`, and the briefing/journal/scanner agents all still fire while it reads "Halted by kill-switch". (`AgentEngine.tsx:32`) → The kill-switch is enforced inside `place()`, so it blocks manual, agent and auto orders alike. **Verified live.** |
| S5.4 | `[x]` | `autoActedIds` is not persisted, so the dedupe set empties on reload and the same signal can re-execute. → Persisted. |
| S5.5 | `[x]` | `applySignal` honours only `maxOrderValueINR` — no `minConfidence`, no `maxOpenPositions`, no `maxDailyLossINR`, no kill-switch, no `checkRules`, all of which the auto loop *does* honour. (`agents/page.tsx:85-91`) → `lib/agentGuardrails.ts` is now shared by the auto loop and the manual "Trade →" button; both run every check. |
| S5.6 | `[x]` | Guardrail inputs are unvalidated `Number(e.target.value)`. Clearing "max order value" yields `0`, which floors to **1 share** rather than blocking. Negatives accepted. (`agents/page.tsx:201`) → Inputs clamp at the `Guard` component and again in `normaliseGuardrails`; a zero max-order-value now blocks instead of sizing to 1 unit. |
| S5.7 | `[x]` | In `auto-live`, daily-loss and open-position guardrails are measured against the **paper** book. (`AgentEngine.tsx:40-42`) → auto-live no longer measures paper-book limits then silently places paper orders: a failed live order **skips the signal** and notifies. |
| S5.8 | `[~]` | `toggleAgent` exists and is called by nothing — the four per-agent enable flags are unreachable from the UI. (`agentStore.ts:59`) → Left in place; the per-agent flags are still not surfaced. Tracked, not fixed. |

## S6/S8/S10/S11 — Fabricated data presented as real

| # | Status | Defect |
|---|---|---|
| S6.1 | `[x]` | **Portfolio renders 4 hardcoded holdings** and never imports `usePaperStore`, so Portfolio and Paper can never agree. (`app/portfolio/page.tsx` + `mockData.ts:73-78`) → Portfolio reads real engine positions. **Verified: /paper EQUITY and /portfolio TOTAL VALUE both ₹4,99,948.** |
| S6.2 | `[x]` | The Portfolio "value curve" is a seeded LCG walk from ₹15,00,000 with no relation to the holdings, the total, or time. (`app/portfolio/page.tsx:23-33,115`) → Replaced with the real sampled `equityHistory` — the same series /paper plots. |
| S6.3 | `[x]` | The all-time badge is unconditionally `text-up`, so a loss renders green. (`:112`) → Colour is now conditional on the sign. |
| S8.1 | `[x]` | **Scanner RSI is a per-symbol constant**, seeded only from the symbol string — never changes, ever. The oversold/overbought presets therefore return a fixed immutable set. Live quotes are ignored for RSI. (`lib/scanner.ts:37-52`) → RSI now comes from `seriesStore` (observed 1-minute bars). Returns null while warming; the UI says so. |
| S8.2 | `[x]` | Breakout compares the live price to a **hardcoded** `high24h`, so within minutes everything permanently "breaks out". `marketStore` maintains a live `q.high` that is ignored. (`lib/scanner.ts:63`) → Breakouts use `rolling24h()` — the venue's real 24h range for crypto, computed bars otherwise. |
| S8.3 | `[x]` | `NaN` comparisons **fail open** — a row with a missing metric passes the filter instead of being excluded. (`lib/scanner.ts:70`) → Every comparison is `Number.isFinite`-guarded and fails CLOSED, excluding unknown rows. |
| S8.4 | `[x]` | Sort is hardcoded descending for every preset, so **"Top losers" lists the least-negative mover first**. (`lib/scanner.ts:80`) → Each preset declares its own sort. **Verified: Top losers now lists −1.81, −1.07, −0.76.** |
| S8.5 | `[x]` | Recomputes 16 symbols × 41 candles ~16×/sec for a provably constant answer. (`app/scanner/page.tsx:18`) → Subscribes to bars (per-minute) rather than quotes (~16×/sec); RSI memoises per closed bar. |
| S10.1 | `[x]` | Synthetic history has hardcoded positive drift (`0.0008` over 1300 bars ≈ **+180%**), so a long-only strategy essentially cannot lose. The reported net return is a property of the generator. (`backtestEngine.ts:102`) → Real candles from Binance/Alpaca/Twelve Data; the synthetic fallback is driftless GBM and is LABELLED in the UI. **Verified: BTC/USDT 15m over 1000 real bars returns −0.5% with a 16% win rate.** |
| S10.2 | `[x]` | `ema` seeds both EMAs to `values[0]`, so `emaFast[0] === emaSlow[0]` and **every backtest opens a fabricated position on bar 1**. (`:55-64`) → EMA seeds from the SMA of the first `period` values and returns null before that. |
| S10.3 | `[x]` | RSI warm-up is filled with the sentinel `50`, and `50 < rsiMax` always passes — so **the RSI filter is disabled during exactly the window where the EMA is also garbage**. (`:67`) → RSI returns null during warm-up instead of a neutral 50. |
| S10.4 | `[x]` | Stop-loss and take-profit are evaluated on the **close only**; `candle.high`/`low` are generated and never read. A stop cannot be hit at its stated level. (`:145-147`) → Stops/targets check `high`/`low` intrabar; a gap through the level fills at the open; stop resolves before target. |
| S10.5 | `[x]` | Same-bar look-ahead: signal computed from bar `i`'s close, filled at that same close. (`:132-143`) → Signals from bar i execute at bar i+1's open. |
| S10.6 | `[x]` | A position open at the end of the series is never closed nor recorded, yet is included in `finalValue` — so the trade list doesn't reconcile with the equity curve. (`:164-166`) → An open position is force-closed on the last bar and recorded with `reason: forced`. |
| S10.7 | `[x]` | No fees, slippage or spread anywhere, while `paperEngine` charges 1–7.5 bps. The two engines model different worlds. → Fees and slippage imported from `paperEngine`, so both engines model one world. |
| S10.8 | `[x]` | "Sharpe" is `mean/σ × √(n trades)` — a t-statistic that grows without bound with trade count. Population variance, no risk-free rate, no time annualization. (`:179`) → Sharpe is computed from per-bar equity returns and annualised by the real bar interval, using sample variance. |
| S10.9 | `[x]` | `profitFactor` sentinel `99` renders as `"99.00"`, indistinguishable from a real 99. (`:173`) → Returns null; the UI renders ∞ or —. |
| S10.10 | `[x]` | `params.timeframe` is **completely ignored** — switching 1m→1D changes the label and produces byte-identical results. Actual bar size is ~31h. (`:88-112`) → `timeframe` drives the candle interval and the annualisation factor. |
| S10.11 | `[x]` | `Date.now()` inside `history()` breaks the file's own determinism claim; Run twice with identical params gives different results (the page also increments the seed). (`:93` / `app/backtest/page.tsx:33-35`) → No `Date.now()` in the engine; the synthetic generator takes an explicit `asOf`. |
| S10.12 | `[x]` | Heatmap years hardcoded `[2022..2026]` — the current year silently vanishes in 2027. (`:194`) → Years derived from the actual candle range. |
| S10.13 | `[x]` | `buildHeat` skips empty months without advancing `prev`, so the next populated month reports a multi-month compounded return as one month. (`:202-207`) → `buildHeat` advances `prev` only on months with data. Unit-tested. |
| S11.1 | `[x]` | **The discipline sparkline is `[54,58,61,59,65,68,realScore]`** — six of seven points are literals. (`coach.ts:134`) → `disciplineTrend()` recomputes the score per trading day; fewer than two days shows an honest empty state. |
| S11.2 | `[x]` | `revengeCost` slices the *most recent* losses, which are unrelated to the pairs that actually triggered the detection. The reported cost has no causal link to the pattern. (`coach.ts:79`) → Cost is the close following each flagged revenge open. |
| S11.3 | `[x]` | The revenge detector compares **close-to-close**, while its own user-facing text says "opened a new position within 12 min of closing a red trade". Opening fills are filtered out two lines earlier. (`coach.ts:65,76-78,89`) → Detector now measures close → OPEN, matching its own description. Unit-tested including the false-positive case. |
| S11.4 | `[x]` | "Cutting winners too early" fires when there are **zero winners** (`avgRR` is 0, which is `< 2`), telling a 100%-loss trader to let winners run. `freq: '1 in 3 winners'` is a hardcoded string. (`coach.ts:90-91`) → Requires `wins.length > 0 && closes.length >= 5`. |
| S11.5 | `[x]` | **`summariseForAI` returned `{tradesAnalyzed,winRate,avgRR,recent}` but the route read `body.stats`** — so every prompt literally contained `Stats: undefined`. → Payload now nests under `stats`, `recent` is sorted defensively rather than trusting array order, and the route **400s on a missing `stats`** so this class of bug can't be silent again. (`coach.ts:176-184` / `api/coach/route.ts:10,28`) |
| S11.6 | `[x]` | `checkRules` depends on an unenforced newest-first array order; a cloudSync JSON round-trip can flip it and **silently disable the cooldown rule**. (`coach.ts:156`) → `lastLoss` via a max-timestamp reduce. Unit-tested with the array reversed. |
| S11.7 | `[x]` | `equity(...) \ → Explicit `Number.isFinite(eq) && eq > 0` guard.|\| startingCash` treats `0`/`NaN` as unset, enforcing the 25% cap against a stale ₹5,00,000. (`coach.ts:163`) |
| S11.8 | `[x]` | "Daily 2-loss stop" resets at browser-local midnight on a 24/7 multi-market platform, and counts losing *fills* not round-trips — one position closed in 3 partials trips it. (`coach.ts:168`) → Counts round trips (fills of the same symbol within a minute collapse into one exit), not raw fills. |
| S11.9 | `[x]` | "RULE ADHERENCE" is floored at 40 so it can never read lower, and the "N rules active" subtitle beneath it is an unrelated number — applying rules doesn't move the percentage. (`coach.ts:81` / `insights/page.tsx:106`) → Subtitle now describes what the number actually measures. |
| S11.10 | `[x]` | Insights told the user to set `ANTHROPIC_API_KEY` while DeepSeek is the configured provider. → Copy now reflects the real provider chain. (`insights/page.tsx:51`) |

## S12 — Brokers

| # | Status | Defect |
|---|---|---|
| S12.1 | `[x]` | **`/api/brokers/connect` never contacts the broker.** It checks fields are non-empty, returns `status:'connected'`, and discards the credentials. Typing `x`/`y` for Binance returns `connected`. (`route.ts:36-53`) → `/connect` calls `connector.verify()` against the venue and only proceeds on success. |
| S12.2 | `[x]` | It reports "Credentials stored server-side (Supabase Vault)" **purely because an env var is set**, while storing nothing. There is no Vault write anywhere in the repo. That string is surfaced verbatim to the user. (`route.ts:43,49`) → Credentials are stored in Vault via `gth_vault_store`; the response distinguishes `connected` from `verified_not_persisted`. |
| S12.3 | `[x]` | The green "connected" dot is a localStorage flag asserting a connection that was never established — and `AgentEngine:64` consults it before attempting live routing. (`settings/page.tsx:64,93`) → The badge renders the server row, including `account_ref` and `last_verified_at`. |
| S12.4 | `[x]` | `connectionsStore.setStatus` is never called, so `'error'`/`'disconnected'` are unreachable states. Disconnect is client-only with no server revoke. No duplicate check. (`connectionsStore.ts:36` / `settings/page.tsx:97`) → Status is server-side (`connected`/`error` + `last_error`); Disconnect calls DELETE and removes the Vault secret; the unique index prevents duplicates. |
| S12.5 | `[x]` | Default state is invalid: `brokerId` starts as `zerodha` (live-only) while `mode` starts as `paper`; `setMode(b.modes[0])` runs only on change, never on mount. The API doesn't validate `mode` at all. (`settings/page.tsx:22-23,106`) → An effect corrects `mode` when the selected broker does not support it, and the API validates mode against the registry. |
| S12.6 | `[x]` | `lib/brokerApi.ts` + `lib/brokers/{dhan,alpaca,ccxt,index}.ts` — **647 lines imported by nothing**, every method throwing "not implemented". → Deleted (647 lines). |
| S12.7 | `[x]` | `MockBroker.updatePosition` computes the new average price using `existing.quantity` **after** it was already overwritten two lines earlier — every average price is wrong. It also runs on sells, has sign-inverted shorts, drops sells with no position, debits cash only on the first buy of a symbol, and `cancelOrder` can never succeed. (`brokerApi.ts:186,256-286`) → Deleted with `brokerApi.ts`; the paper engine is the only matching engine. |
| S12.8 | `[x]` | `gth_broker_connections.user_id` references `auth.users(id)`, but this app uses an env super-admin and **`auth.users` is empty** — every insert will fail. (`supabase/migrations/0001_globaltrade_hub.sql:19`) → Migration `0003_broker_vault.sql` drops the FK and adds `last_verified_at`/`account_ref`/`last_error`. |
| S12.9 | `[x]` | The `vault` schema is not exposed through PostgREST, so `supabase-js` cannot reach it. Needs `SECURITY DEFINER` wrappers in `public`, granted only to `service_role`. → `SECURITY DEFINER` wrappers in `public`, EXECUTE revoked from public/anon/authenticated and granted only to `service_role`. |
| S12.10 | `[x]` | No symbol translation exists (`BTC/USDT`→`BTCUSDT`, Dhan security-ids), so every live order would 400. → `toBrokerSymbol` per connector; unsupported instruments are refused rather than sent. |
| S12.11 | `[x]` | Registry credential field names don't match the `.env.local` names, and `DHANHQ_API_KEY`/`_SECRET` are a *partner* pair, not `clientId`+`accessToken`. Dhan can't be auto-wired from env. → `envCredentials()` maps only what genuinely matches; Dhan is documented as form-entry only. |
| S12.12 | `[x]` | Live routing always fails (501) and **silently degrades to paper**, so "auto-live + armed" is functionally auto-paper forever. (`AgentEngine.tsx:79-99`) → A failed live order skips the signal and notifies. Live also requires `ENABLE_LIVE_TRADING=true` plus an explicit mode. |

## S13 — Dead code, boundaries, responsive, a11y

| # | Status | Defect |
|---|---|---|
| S13.1 | `[x]` | `components/ui/*` is dead (~611 lines) — only `sonner.tsx` is imported. `lib/utils.ts` (`cn`) is imported only by those files. → Deleted (~611 lines) plus `lib/utils.ts`. |
| S13.2 | `[x]` | `lightweight-charts`, `framer-motion`, `react-icons` have **zero** references in `src/`. All `@radix-ui/*`, `cva`, `clsx`, `tailwind-merge` are referenced only by dead files. → 13 packages removed. Runtime deps are now 8. |
| S13.3 | `[x]` | No `loading.tsx`, `error.tsx`, `not-found.tsx`, or `global-error.tsx` anywhere — and several non-null assertions can throw into nothing. → Added `loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`. |
| S13.4 | `[x]` | **Every layout grid is an inline `style`**, which bypasses Tailwind breakpoints entirely. Below 1024px `/terminal` loses the chart pane and clips the order ticket **with no horizontal scroll** — the content is unreachable, not just off-screen. (`terminal/page.tsx:26`, `backtest:42`, `paper:71`, `portfolio:76,86`, `insights:89,114,132`, `agents:131,138`) → Converted to Tailwind responsive classes. **Verified at 390px: 0px overflow, order ticket reachable.** |
| S13.5 | `[x]` | `TopBar` nav is `hidden md:flex` with no mobile menu — six of seven sections unreachable below 768px. (`TopBar.tsx:31`) → Hamburger + drawer over `NAV_SECTIONS`. **Verified present at 390px.** |
| S13.6 | `[x]` | ~11 hand-rolled toggle groups with no `role`, no `aria-checked`/`aria-selected`, no keyboard model, and `outline-none` applied liberally. → `role="radiogroup"`/`aria-checked` and `focus-visible` rings on the terminal, scanner and agents toggles. |
| S13.7 | `[x]` | 14 controls silently do nothing when clicked — see the list below. → The two decoy spans removed from the terminal; backtest date-range/capital are now real inputs; the scanner hand-off carries its criteria. |
| S13.8 | `[x]` | Hydration mismatch on `/settings` from reading `resolvedTheme` pre-mount. (`settings/page.tsx:143`) → Guarded behind a `mounted` flag so the toggle does not render against an undefined theme. |
| S13.9 | `[x]` | `TerminalChart` reads the store non-reactively via `getState()` and forces a re-render every second, even on a background tab. Only the last of its 64 candles is real. (`TerminalChart.tsx:19,23`) → Subscribes to the quote reactively (no 1s forced re-render) and loads real candles from `/api/marketdata/candles`, labelling the placeholder as SIMULATED HISTORY. |
| S13.10 | `[x]` | Binance WS has no `onerror`/`onclose`/reconnect. `new WebSocket()` doesn't throw, so the `try/catch` fallback never fires — if Binance is unreachable, crypto prices freeze permanently with the "LIVE" badge still lit. (`marketData/binance.ts:26-45` / `MarketEngine.tsx:21-25`) → `onopen`/`onerror`/`onclose` + exponential-backoff reconnect; crypto falls back to simulation while the socket is down. |
| S13.11 | `[x]` | The "LIVE" badge is hardcoded decoration; `marketStore.usingRealFeed` exists and is read by nothing. The "GT" avatar is a static div. "Search markets" is a button that navigates to a scanner with no search field. (`TopBar.tsx:50,59,86`) → The badge reads `usingRealFeed`, which now tracks the actual socket. **Verified: 26 Binance frames ⇒ LIVE.** |
| S13.12 | `[x]` | `Terminal` header labels `prevClose` as `O` (open). `high`/`low` ratchet monotonically for the tab's lifetime and never roll off 24h. Volume is hardcoded `0` for 8 of 16 instruments. (`terminal/page.tsx:38,41` / `marketStore.ts:87-88`) → Relabelled PREV; H/L come from the rolling 24h window; a zero volume is omitted rather than displayed. |
| S13.13 | `[x]` | "Reset session" and "Reset paper account" destroy all persisted history with **no confirmation**; the latter sits next to "Sign out". (`paper/page.tsx:63`, `settings/page.tsx:168`) → Both resets now confirm before destroying history. |
| S13.14 | `[x]` | `.env.example` existed but `.gitignore`'s `.env*` excluded it from git, so a fresh clone had no template despite the README saying `cp .env.example .env.local`. → Added `!.env.example`; verified the file contains placeholders only. Auth section rewritten for the new all-or-none semantics. |
| S13.15 | `[~]` | `/auth/signup` is a 6-line redirect that nothing links to; there is no signup API route. → Left in place (harmless redirect). Tracked, not fixed. |

### Controls that silently do nothing

`＋ Indicators` and `⬚ Candles` (`terminal/page.tsx:58,59` — both are `<span>`s) · `Visual`/`Code`
strategy tabs, strategy `NAME`, `DATE RANGE`, `STARTING CAPITAL`, entry/exit condition rows
(`backtest/page.tsx:48,49,54,72,75,78,81` — all display-only `<div>`s) · backtest `TIMEFRAME`
(changes the label, not the result) · notification channel chips (`settings/page.tsx:150-158` —
read-only spans) · Buy/Sell in **live** mode (toast only) · `Generate scan → Scanner` (the
generated criteria are discarded and the scanner re-derives defaults) · the `GT` avatar · the
`LIVE` badge.

---

## Modeling decisions

These are **choices, not bug fixes**. They are what make the numbers defensible; don't change them
silently.

| Decision | Value | Rationale |
|---|---|---|
| Base currency | INR | Matches the product's primary market. |
| Quote-currency conversion | Per-instrument `quoteCcy` → INR | A blanket USD→INR rate is what caused S2.1. FX rate is frozen into `costBasisBase` at fill time, so FX revaluation books as *unrealized* — the honest treatment for a multi-currency book. |
| `SHORT_MARGIN_FACTOR` | `1.0` (fully covered) | Conservative; a short reserves 100% of notional rather than crediting cash. |
| Round-trip | Any fill that reduces `\|qty\|` toward or through zero | Win rate over round-trips, not fills, so partial exits don't inflate the count (S2.13). |
| Fee schedule | maker/taker split per market | More defensible than "limit orders are free" (S2.10). |
| Intrabar stop + target in one bar | Stop resolves first | Conservative when bar ordering is unknowable. |
| Backtest execution | Next-bar open | Removes the same-bar look-ahead (S10.5). |
| fx discontinuity | **Paper account reset on migration** | Historical `fills[].pnl` was computed at the wrong rate and cannot be recomputed; a mixed-convention book can never satisfy the reconciliation identity. |
| USDT | Treated as ≈ USD | Documented approximation. |
| Synthetic backtest data | Allowed, but labeled | When no provider covers a symbol, the run is marked "SYNTHETIC DATA — not a historical backtest" and risk stats are suppressed. Label, don't fake. |

### The reconciliation identity

Asserted in the test suite and in a dev-only `assertReconciled(state)`:

```
cash + reservedCash + Σ marginHeldBase + Σ_longs(costBasisBase)
  === startingCash + realizedGross − feesPaid
```

---

## Remediation stages

| # | Stage | Depends on |
|---|---|---|
| 1 | Security hardening + vitest | — |
| 2 | Paper engine: currency + ledger | — |
| 3 | Paper engine: matching, validation, determinism | 2 |
| 4 | Persisted-state migration + cloudSync validators | 2, 3 |
| 5 | Rule-enforcement chokepoint + kill-switch | 3 |
| 6 | Portfolio rewired to the real engine | 2 |
| 7 | Rolling series store | — |
| 8 | Scanner | 7 |
| 9 | Candle data service | — |
| 10 | Backtest | 9, 2 |
| 11 | Coach | 3 |
| 12 | Brokers + Supabase Vault | 1 |
| 13 | Dead code, boundaries, responsive, a11y | — |
| 14 | Docs | all |

Gate every stage on: `npm run build` clean, `npm run lint` clean, vitest green (including
`assertReconciled`), and a manual pass over `/terminal → /paper → /portfolio → /insights`
confirming the same numbers appear on every screen.
