# Running strategies unattended

Automation in this app runs in two places, and **only ever one at a time**.

| | where it runs | when it acts |
|---|---|---|
| **Browser loop** | `StrategyEngine`, mounted in the app shell | while a tab is open, every 60s |
| **Server runner** | `/api/automation/run` | only when no browser tab has checked in |

Both evaluate the same strategies against the same candles and reach their decisions
through the same module (`lib/automation/decide.ts`). What differs is only where the book
is read from and how it is written back.

---

## Why only one at a time

The paper ledger cannot survive two writers.

The monotonicity guard in `api/state/[key]/route.ts` rejects a write whose `state.seq` is
**older** than the server's. Equal seq passes. So a tab at seq 100 and a runner at seq 100
can each place an order, each write seq 101, and **one order is silently lost** — while the
ledger identity still balances, because each book is internally consistent on its own.

Merging two divergent order books is not solvable correctly, so this app does not try. Two
mechanisms make it impossible instead:

1. **A lease.** The browser posts a heartbeat every 45 seconds while it is running
   strategies. The server runner refuses to act if a heartbeat has landed in the last 3
   minutes. The browser always wins, because if a tab is open it is already doing the work.
2. **A compare-and-set write.** The runner reads `seq` at the start and writes back only if
   the row still carries that `seq`. A tab can open *mid-run*, so the lease alone is not
   enough. If the book moved, the run is abandoned rather than merged.

There is a third, narrower duplicate the lease cannot catch, because it happens across a
*handover* rather than concurrently. Signal ids are deterministic —
`${strategyId}:${symbol}:${barTime}:${actionKey}` — so whichever runner takes over derives
the same id for the same bar. Runtime memory is deliberately never persisted, so a runner
starting fresh would happily re-place an order the other just made. The lease therefore
carries a list of acted-on signal ids, shared by both.

## What the runner refuses to do

- **Trade on stale FX.** `deriveFxRates()` prices the entire ₹ book from `USD/INR`. Without
  a live rate it falls back to a constant and flags itself stale — a fallback that was once
  14.5% wrong, which would misprice every non-INR position. A run that does nothing is
  recoverable; a book priced on a guess is not.
- **Trade on generated candles.** Where no provider covers an instrument the app can serve a
  clearly-labelled synthetic series so charts still draw. That is not a basis for an order.
- **Act on a `review` instance.** Review mode is waiting for a human to approve the signal,
  and the server cannot obtain that approval. Only `auto` instances run unattended.
- **Act with the kill switch on**, or past any guardrail — the same set the browser applies.

## Setting it up

The endpoint needs `CRON_SECRET` set in `app/.env.local`. It fails closed in production if
that is unset, because it places orders.

```bash
BASE_URL=http://localhost:3000 CRON_SECRET=... ./scripts/scheduler.sh
INTERVAL=300 ./scripts/scheduler.sh      # every 5 minutes
MAX_TICKS=5  ./scripts/scheduler.sh      # stop after 5 ticks
```

A single run, by hand:

```bash
curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/automation/run
```

### Keeping it alive

**A sleeping laptop is a stopped scheduler.** This is the honest limitation of a
self-hosted loop, and it is why the app derives "running on the server" from a real
heartbeat rather than from this script having been started once.

On macOS, `launchd` with `KeepAlive` restarts it after a crash but does **not** run it while
the machine is asleep — use `caffeinate` or a machine that stays awake. On Linux, a
`systemd` service with `Restart=always` behaves the same way.

Vercel Cron is deliberately not used: the Hobby tier allows one run per day, which is
useless for anything but end-of-day strategies.

## Resetting the paper book

The end-to-end tests place **real paper orders**, so your book gains history. Nothing here
resets it for you. To start over, use the reset control in the app — that path also clears
the cloud row, which deleting localStorage alone would not.

## What is not built

- The runner has no persisted evaluation memory. It relies on the shared acted-signal list
  instead, which is sufficient for suppressing duplicates but means cooldown windows are
  not carried across runs.
- There is no UI yet showing which runner currently holds the lease. The data is there
  (`serverRanAt`, `browserHeartbeatAt` on the `automation` row); the indicator is not built.
- `npm run test:e2e` still does not work: `@playwright/test` has never installed here. The
  end-to-end suite runs against a separately-provided Playwright — see the header of
  `scripts/e2e.mjs`.
