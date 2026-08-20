# What is pending

An honest inventory: what is built and reachable, what is built and unreachable, what is
deliberately not built, and what is still stale.

This is not `docs/AUDIT.md` — that stays as the historical record of the defect
remediation. This file answers a different question: **if you sat down to use this app
today, what would you find, and what would you not.**

Verified against the code on **2026-08-20**. Counts: **661 unit tests across 33 files ·
135 lessons across 16 tracks · 24 strategies · 31 page routes · 19 API routes**, plus an
end-to-end suite of ~50 checks in `app/e2e/`.

---

## The thing worth knowing first

**This app has repeatedly gone false about itself**, and the pattern is always the same:
copy that was true when written, invalidated by something shipping, and never revisited.

The largest case was the derivatives track. Written when there was no options layer,
stating so in nine places, and left saying it for four releases after PRs 46–50 built
one. `/strategies/unavailable` was corrected three times in that period; the lessons were
not. One entire lesson enumerated "four things that would have to be built", all four of
which existed, and its quiz graded the wrong answer as correct.

That is fixed, along with five smaller cases. But the failure mode is structural, not a
one-off, so it is listed here as an ongoing risk rather than a closed item. **Anything
that says a feature is missing should be re-read whenever that feature area changes.**

---

## Built and reachable

| Area | What works |
|---|---|
| **Market data** | Live Binance crypto websocket. Yahoo for India/US/FX/commodities via a router with fall-through, all behind `cachedFetch` (TTL, single-flight, token bucket, circuit breaker). Finnhub for US real-time, fundamentals and earnings. |
| **Paper engine** | Deterministic matching, real Indian charge stack, a ledger identity asserted by a 300-step randomised test, cloud sync with a server-side monotonicity guard. |
| **Options** | Live NSE NIFTY/BANKNIFTY chain, solved Greeks and IV, multi-leg orders with OCO and brackets, approximate margin, cash settlement at expiry. |
| **Strategies** | 20 equity + 4 options, each with entry, exit, where-it-works, where-it-fails and caveats. |
| **Backtesting** | Single-window comparison, walk-forward in a web worker, portfolio sleeves with a correlation matrix, and a separate options runner. |
| **Learn** | 117 lessons across 15 tracks, every one with a visual. Practice lessons verified against the paper ledger. |
| **Research** | US fundamentals, earnings calendar, live NSE IPOs, crypto reference data — each distinguishing "we have data" from "not covered" from "the source failed". |

---

## Built, but you cannot reach it

| What | Where | Why it matters |
|---|---|---|
| `chainCoverage()` | `lib/options/snapshot.ts:160` | Zero importers, not even a test. It answers "how many days of real option history exist" — which the options backtest screen should be showing instead of implying history is available. |
| Options **real-chain** backtesting | `lib/options/backtest.ts` | The runner accepts any chain series, but only the synthetic generator is wired. Reading stored snapshots back out is not implemented. |
| `toggleAgent` | `stores/agentStore.ts:59` | Called by nothing; four per-agent flags are unreachable from the UI. Logged as AUDIT S5.8. |
| `/auth/signup` | `app/auth/signup/page.tsx` | A 5-line redirect nothing links to. Logged as AUDIT S13.15. |

---

## Deliberately not built

These are decisions, not omissions. Each is stated in the app at
[`/strategies/unavailable`](../app/src/app/strategies/unavailable/page.tsx).

- **MVRV on-chain** — needs a paid feed (~$30/mo).
- **Order-book imbalance** — live depth is fetchable; historical L2 essentially does not
  exist. Runnable but never testable, which is a guess with extra steps.
- **Triangular FX arbitrage** — needs tick bid/ask on three pairs. On delayed mid prices
  any "arbitrage" found is a data artefact.
- **Dark pool sentiment**, **Fed statement NLP** — paid or low-latency feeds only.
- **FII/DII flows** — NSE publishes them and blocks programmatic access (verified 403).
- **Calendar spreads** — no futures curve; commodity tickers are spliced continuous
  front-month with no individual expiries.
- **Stock options** — physically settled and American-style. A different engine.
- **Futures and perpetuals** — no instrument in the paper engine, which is why
  funding-carry ships signal-only.

## Not modelled, and stated where it matters

Circuit filters · ASM/GSM surveillance · market depth · the pre-open auction ·
corporate-action adjustment of price series · tax of any kind · SPAN margin (an
approximation is used and labelled) · spread margin benefit (charged per leg, so
conservative) · NSE's 30-minute closing settlement average (last mark used instead).

---

## Genuinely open

### 1. Playwright is written but has never run
`app/e2e/` and `playwright.config.ts` exist, `npm run test:e2e` is defined — and
`@playwright/test` **is not installed**. **Four** install attempts have now timed out
against the registry from this machine, across two Node versions and two npm versions,
including one with a raised `--fetch-timeout`. Chromium itself is cached locally, so
this is specific to fetching that one package.

Treat it as an environment problem rather than a project one: `npm i -D @playwright/test`
from a machine that can reach the registry should be all it takes.

`npm run verify` still passes because it does not include e2e. **`npm run test:e2e` will
fail until `npm i -D @playwright/test` succeeds**, and the selectors in
`honesty.spec.ts` have never been executed — expect to fix some on the first real run,
because untested selectors are guesses.

### 2. Real option history has barely started
The nightly snapshot is now scheduled (`vercel.json`, 10:15 UTC = 15:45 IST, just after
the NSE close) and the cron route accepts Vercel's `Authorization: Bearer` — it
previously accepted only `?secret=` and `x-cron-secret`, so a scheduled run would have
401'd silently forever while manual curls passed.

But history accumulates one trading day at a time and **no free source can backfill it**.
Until there is enough, three of the four options strategies cannot be tested at all: they
enter on a gap between implied and realised volatility, and a synthetic chain has them
equal by construction. The backtester says so explicitly rather than reporting a silent
zero.

### 3. A setting changed mid-hydration can be silently reverted
Zustand rehydrates a persisted store from localStorage, and `cloudSync` then applies the
server row on top. A control changed inside that window is accepted by the UI and then
overwritten by either stage — no error, no notice.

Found while writing the end-to-end suite, which reported it as "a guardrail does not
survive a reload". It does; the change had simply been made before the store settled. The
window is short and a person is unlikely to hit it, but a risk control that reverts
without saying so is exactly the failure this codebase keeps having to correct.

No hydration flag is exposed, so nothing in the UI can currently disable a control until
its store has settled. The test works around it by waiting for the store to stop changing.

### 4. `lib/scanner.ts` has three fixed defects and no regression test
AUDIT S8.1–S8.3 were fixed with nothing to stop them returning. Highest-value missing
test in the repo.

### 5. Other untested modules
`strategies/place.ts` (the order chokepoint), `cloudSync.ts`, `instruments.ts`,
`options/snapshot.ts` (the cron writer), every market-data provider, every broker
adapter, and all of `lib/notify` and `lib/ai`.

### 6. Stale documentation
| File | State |
|---|---|
| `ARCHITECTURE.md` | **Updated 2026-08-20** — now covers automation, the lease, provenance and the real test counts. |
| `DOCUMENTATION.md` | **Updated** — the phantom `lib/backtestEngine.ts` reference is gone. |
| `PROVIDERS.md` | **Updated** — it no longer tells you to set two variables the app never reads. |
| `MARKET-DATA.md` | Mostly current; no row for the NSE option chain. |
| `AUDIT.md` | Header says "1 open" but no `[ ]` row exists; the S5 heading claims S5.5–S5.7 are open when they are marked done. |
| `E2E_TESTING.md` | **Deleted** — described a suite that was never written and prescribed a script that does not exist. Superseded by `USER-ACCEPTANCE.md`. |

---

## Recently corrected

For the record, so the next audit does not re-find them:

- Nine `inApp` blocks in `tracks/derivatives.ts` claiming options, Greeks, IV and
  multi-leg orders did not exist.
- The `options-in-this-app` lesson and its wrongly-graded quiz.
- `/strategies` never rendering the options family — `OPTIONS_STRATEGIES` could not enter
  the `Strategy` registry (different shape), so the section and its blurb were dead code.
  Now rendered, with `/strategies/options/[id]` detail pages that also make
  `runOptionsBacktest` reachable.
- A hardcoded "Twenty rule sets" that is now derived.
- `/insights` claiming live routing was unimplemented — it is implemented, and saying
  otherwise understated real risk.
- `.env.example` claiming `FINNHUB_API_KEY` was unwired while it powered `/research`;
  `EIA_API_KEY` undocumented though lessons instruct users to set it; two dead
  `MARKETDATA_*` variables read by nothing.
- 95 lessons with no visual, and a visual registry where a key without a component gave a
  blank lesson and a passing test.
