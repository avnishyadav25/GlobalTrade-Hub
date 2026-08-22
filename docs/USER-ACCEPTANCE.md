# GlobalTrade Hub — user acceptance walkthrough

Every feature, in the order it was built, with what to click and **what would mean it is
broken**.

That last part is the point. A checklist step that says "open Funds and check the charges"
cannot fail — you will look at a number, it will be a number, and you will tick the box. So
every check below says what the *wrong* answer looks like. If you cannot make a step fail, it
is not testing anything.

This document is for a **person**, walking the app by hand. It is not the automated suite
and does not overlap with it much: the checks here are about whether a screen tells you the
truth, which is easier for a human to judge than to assert.

The automated suite lives in [`app/e2e/`](../app/e2e/) and **does now run** — 54 checks,
currently all passing:

```bash
ADMIN_EMAIL=... ADMIN_PASSWORD=... \
NODE_PATH=/path/to/a/playwright/node_modules node scripts/e2e.mjs
```

`npm run test:e2e` still does **not** work: `@playwright/test` has never installed here
despite six attempts, and `playwright.config.ts` cannot resolve it. See
[PENDING.md](PENDING.md).

For a picture of what a passing run looks like, [AUTOMATED-TRADING.md](AUTOMATED-TRADING.md)
is generated from that suite — 48 screenshots of a real paper book, including the refusals.

**Where to go for what**

| To do this | Read |
|---|---|
| Run strategies unattended | [AUTOMATION.md](AUTOMATION.md) |
| Learn to trade | in-app `/start` and `/learn`, or [PAPER-TRADING-CAREER.md](PAPER-TRADING-CAREER.md) |
| Know what is real and what is not built | [PENDING.md](PENDING.md) |
| Understand the internals | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Set up API keys | [GETTING_STARTED.md](GETTING_STARTED.md), then [PROVIDERS.md](PROVIDERS.md) |

---

## Before you start

```bash
cd app
npm install
npm run verify     # 676 tests, lint, build. Everything below assumes this is green.
npm run dev        # http://localhost:3000
```

Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env.local`. There is no user database —
authentication is a single env-configured super-admin with an HMAC session cookie.

> **A note on numbers.** Prices in this app are a mix of real and simulated, deliberately. Crypto
> is a live Binance websocket. FX, commodities and Indian equity come from real providers.
> US equity movement is simulated. Anywhere a series is generated rather than fetched, the screen
> says so — and a screen that *stops* saying so is itself a defect.

---

## 1 · Terminal and market data — PRs 1–20, 27

**1.1 Real prices are real**

1. Open [/terminal](http://localhost:3000/terminal), select `BTC/USDT`.
2. Watch for thirty seconds.

**Expect:** the price ticks and the header shows a live badge. Crypto comes from a real Binance
socket.

❌ **Broken if:** the price never moves, or a simulated instrument claims to be live.

**1.2 An instrument you add yourself gets real data**

1. Go to [/watchlists](http://localhost:3000/watchlists), add `TCS.NS`.
2. Return to the Terminal and select it.

**Expect:** a real NSE price (TCS traded around ₹2,425 when this was written — the figure will
have moved, the order of magnitude should not).

❌ **Broken if:** it shows a round catalog number that never changes. That was a real bug: added
instruments used to fall back to a mock price.

**1.3 Staleness is distinguished from closure**

1. Open an Indian instrument outside 09:15–15:30 IST.

**Expect:** the badge reads **closed**, not *stale*.

❌ **Broken if:** a shut exchange is reported as a data failure. Those are different problems with
different fixes.

---

## 2 · Orders and the paper engine — PRs 2, 3, 25

**2.1 The order ticket refuses what it should**

1. Terminal → buy `RELIANCE`, quantity `0.5`.

**Expect:** rejected — *"RELIANCE trades in whole units"*.

2. Try a quantity worth more than your buying power.

**Expect:** rejected, and the rejection appears on [/orders](http://localhost:3000/orders) **with
its reason**.

❌ **Broken if:** a refused order vanishes silently. If the Orders screen cannot tell you why
something did not happen, it is not an audit trail.

**2.2 A short does not increase your buying power**

1. Note your buying power on [/funds](http://localhost:3000/funds).
2. Short an instrument.
3. Return to Funds.

**Expect:** buying power **falls**. A short is fully cash-covered here.

❌ **Broken if:** shorting frees up cash to trade with.

**2.3 The ledger reconciles**

1. Place several trades, both directions, some closed.
2. Open [/funds](http://localhost:3000/funds) and find the reconciliation line.

**Expect:** *Reconciles exactly ✓*.

❌ **Broken if:** it reports an error figure. The identity is
`cash + reserved margin + long cost basis − written-option credit = starting cash + realised −
fees`, and it is asserted by a 300-step randomised test. A live mismatch means a real accounting
bug.

---

## 3 · Charges — PR 23

**3.1 Charges are itemised, not blended**

1. Terminal → buy 10 `RELIANCE`.
2. [/funds](http://localhost:3000/funds) → open the fill.

**Expect** separate lines, roughly:

```
brokerage    ₹20.00   (capped — 0.03% would be more)
STT           ₹0.00   (buy side, intraday — sell-side only)
exchange      ₹0.39
SEBI          ₹0.01
stamp duty    ₹0.60
GST           ₹3.67   (on services only, not on STT)
```

❌ **Broken if:** one blended "fees" number, or **STT charged on a buy**. Intraday STT is
sell-side only, and getting that wrong doubles the modelled cost of every round trip.

**3.2 A US buy is genuinely free**

1. Buy a US instrument.

**Expect:** zero fees. US equity is commission-free and the regulatory fees are sell-side only.

❌ **Broken if:** a fee appears. It would mean a blanket rate is being applied per market.

---

## 4 · Strategies — PRs 21–24, 28–32

**4.1 The library is honest about what it cannot do**

1. Open [/strategies](http://localhost:3000/strategies).
2. Find **Perpetual funding carry**.

**Expect:** marked *signal only*, with **no trade button**, and a caveat explaining the paper
engine has no perpetual-futures instrument.

❌ **Broken if:** you can place it. It would open a position unrelated to the strategy described.

3. Open [/strategies/unavailable](http://localhost:3000/strategies/unavailable).

**Expect:** eight entries, each with a reason and what it would take. Options should read
*"buildable, but not backtestable yet"* — **not** "needs an options layer", which stopped being
true at PR 46.

❌ **Broken if:** it still says no option chain feed exists. A list of what is missing is only
worth having if it is corrected when something gets built.

**4.2 Statistics are withheld when the sample cannot support them**

1. [/backtest](http://localhost:3000/backtest) → pick an instrument → run.
2. Find a strategy with fewer than 30 trades.

**Expect:** Sharpe, win rate and profit factor show **—** with *"sample too small"*.

❌ **Broken if:** a Sharpe ratio is printed from nine trades. That is not a weak number, it is a
meaningless one, and greying it out would still invite reading it.

**4.3 Every run is measured against buy-and-hold**

**Expect:** a *Buy & hold* badge and an *N of M beat it* count on every run.

❌ **Broken if:** returns are shown with nothing to compare them to.

---

## 5 · Walk-forward — PR 44

**5.1 It runs without freezing the tab**

1. [/backtest/walk-forward](http://localhost:3000/backtest/walk-forward) → pick a strategy →
   leave the default grid → **Run**.
2. While it runs, click around the rest of the app.

**Expect:** a progress bar advancing through folds, and the app stays responsive. The run happens
in a web worker.

❌ **Broken if:** the tab locks up. A default grid is over a thousand backtests; inline it would
freeze before React ever painted the loading state.

**5.2 Cancel actually cancels**

1. Start a run, press **Cancel**.

**Expect:** it stops immediately.

❌ **Broken if:** it keeps going, or results appear afterwards.

**5.3 The grid tells you when it is too big**

1. Widen a parameter list until the combination count exceeds 400.

**Expect:** a warning that the grid is over the cap, saying whole ranges of the last parameter
would never be evaluated.

❌ **Broken if:** it silently truncates. The search takes combinations in cartesian order, so an
over-sized grid does not sample evenly — it never reaches the end.

**5.4 Degradation is the headline**

**Expect:** in-sample, out-of-sample, and the gap, plus whether the winning parameters changed
between folds.

❌ **Broken if:** only one return is shown. The gap **is** the finding.

**5.5 Short history refuses rather than pretends**

1. Choose a 15-minute timeframe on an Indian instrument and run with 8 folds.

**Expect:** *"Not enough history to split"* with an explanation.

❌ **Broken if:** it produces a confident-looking result from windows of a few dozen bars.

---

## 6 · Portfolio testing — PR 45

**6.1 Diversification is measured, not assumed**

1. [/backtest/portfolio](http://localhost:3000/backtest/portfolio) → select 3–4 instruments →
   **Run portfolio**.

**Expect:** four tiles, including **portfolio drawdown** and **average sleeve drawdown**, and a
*diversification* figure that is the gap between them.

❌ **Broken if:** portfolio drawdown equals the average of the sleeves. They trough at different
times; if the two match, either the instruments really are one position (which the screen should
say) or the curves are not being combined on a shared timeline.

**6.2 An idle sleeve is not "uncorrelated"**

1. Pick a strategy that takes no trades on one of your instruments.

**Expect:** that row and column of the correlation matrix show **—**, with a tooltip explaining a
flat sleeve has no variance.

❌ **Broken if:** it shows `0.00`. Reading that as "uncorrelated" would overstate your
diversification.

---

## 7 · Options — PRs 46–49

**7.1 The chain is real**

1. Open [/options](http://localhost:3000/options).

**Expect:** NIFTY loads with a live underlying level, ~100 strikes, a **lot size of 65** (parsed
from NSE's contract master, not hardcoded), and NSE's own quote timestamp.

❌ **Broken if:** the lot size is 75. That was the old value; SEBI revised it, and the file is
read per-expiry precisely so a stale constant cannot survive.

**7.2 Implied volatility declines where it cannot be measured**

1. Look down the IV column, including deep in-the-money strikes.

**Expect:** some strikes show **—**, and the footnote says how many are unsolvable.

❌ **Broken if:** every strike has an IV. Far from the money, vega is so small that no volatility
can be recovered from the price — NSE reports zero on about a third of a typical expiry for the
same reason. A number in those cells is invented.

**7.3 Buying and writing behave differently**

1. Click a call premium → **Buy** → 1 lot → place.

**Expect:** cash falls by premium × 65. No margin.

2. Click another strike → **Write** → 1 lot.

**Expect:** a **margin required** figure, labelled **"Approximation (not SPAN)"**, and a warning
that a written call has unlimited loss.

❌ **Broken if:** the margin is labelled SPAN. Real SPAN needs NSE's daily risk files; the label
is bound to the model that produced the number and can only say SPAN if one was actually parsed.

**7.4 The ledger survives options**

1. After both trades, check the reconciliation line on Funds.

**Expect:** still exact.

❌ **Broken if:** it drifts. A written option credits premium **and** posts margin — a shape the
engine had no room for before, and the one most likely to break the identity.

**7.5 Lots, not units, but units underneath**

1. Try to place a quantity that is not a multiple of 65 (via the API, since the ticket only
   offers lots).

**Expect:** rejected — *"trades in lots of 65"*.

❌ **Broken if:** accepted. Partial fills must land on lot boundaries too; an early version filled
54 units of a 65-lot contract, which no exchange would produce.

---

## 8 · Multi-leg orders — PR 48b

**8.1 A spread is all-or-nothing**

Place a two-leg spread where one leg is invalid.

**Expect:** **both** legs recorded as rejected, sharing one reason, and **nothing** else moves —
no position, no cash, no reservation.

❌ **Broken if:** one leg places. A half-placed spread is not a smaller spread, it is a naked
position you did not ask for.

**8.2 OCO cancels its sibling**

Place an OCO pair and let one side fill.

**Expect:** exactly one fill, the other **cancelled**, and the reservation released.

❌ **Broken if:** both fill — that is double the intended size.

**8.3 A bracket child does not fire early**

Place a bracket whose take-profit is already in the money, before the parent fills.

**Expect:** nothing happens until the parent fills. Then the children arm **and resize** to what
the parent actually filled.

❌ **Broken if:** the exit fires first — it would open a reverse position out of nothing.

---

## 9 · Expiry settlement — PR 48b

**9.1 Settlement is honest about its price**

**Expect:** the ticket says settlement uses the last available index mark and is **not** NSE's
30-minute closing average.

❌ **Broken if:** it claims to use the official settlement price. We do not have that series.

**9.2 No mark means no settlement**

If no underlying quote is available at expiry, the position stays open and is reported as awaiting
a mark.

❌ **Broken if:** it settles anyway. Fabricating a settlement price is the most tempting unsafe
shortcut in this feature, and it is refused deliberately.

---

## 10 · The chain warehouse — PR 49

**10.1 The cron captures a day**

```bash
curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/tick
```

**Expect:** a `chains` array with `stored: true` for NIFTY and BANKNIFTY, and a strike count
around 100–150.

❌ **Broken if:** `stored: false` with no reason. Every failure path names itself.

**10.2 Coverage is stated, not implied**

**Expect:** wherever real-chain backtesting is offered, the screen says how many days exist.

❌ **Broken if:** an empty chart with no explanation. There is no free historical option chain —
history only accumulates from the day snapshots started, and that is a fact to state rather than
hide.

---

## 11 · Research — PR 35

1. [/research](http://localhost:3000/research) → Company tab → `AAPL`.

**Expect:** real fundamentals (P/E around 34, ROE around 137 when written).

2. Enter an Indian symbol.

**Expect:** an explicit refusal — no free API covers Indian company financials.

❌ **Broken if:** it returns an empty shell that reads as a lookup failure. "We do not cover this"
and "the lookup failed" are different answers.

3. IPO tab.

**Expect:** live NSE issues, **or** *"No issues open — that is a real answer, not a failed
request"*, **or** a fetch-failure warning. Three states, rendered differently.

❌ **Broken if:** all three look the same. That is how a screen starts lying.

---

## 12 · Learn and Library — PRs 33–43

**12.1 A lesson cannot be ticked off**

1. Open any practice lesson.

**Expect:** no "mark as done" button anywhere. Completion comes from your actual paper account.

❌ **Broken if:** you can complete a lesson without doing the thing.

**12.2 Resetting does not un-do reality**

1. [/learn](http://localhost:3000/learn) → **Reset progress**.

**Expect:** a warning that N lessons will immediately return to complete, because your trades
still satisfy them.

❌ **Broken if:** verified lessons stay incomplete after a reset. They are checked against engine
state, not a stored tick.

**12.3 The library links work**

1. [/library](http://localhost:3000/library) → **All**.

**Expect:** ~30 items. Books carry **no** link; everything else does.

❌ **Broken if:** a book links to a shop. A citation cannot rot; an affiliate link is not a
reference.

---

## 13 · Safety rails — PRs 5, 31

**13.1 The kill switch stops everything**

1. [/settings](http://localhost:3000/settings) → enable the kill switch.
2. Try to place an order — from the Terminal, from the Agents screen, and from a strategy signal.

**Expect:** all three refused, each recorded on /orders with the reason.

❌ **Broken if:** any path still places. There used to be three that bypassed the checks entirely.

**13.2 Live routing is refused by default**

**Expect:** with `ENABLE_LIVE_TRADING` unset or not exactly `true`, real-money routing is refused.

❌ **Broken if:** a live order can be routed. The step from paper to live should require a
decision, not a misclick.

---

## 14 · Cloud sync — PR 48a

**14.1 An older device cannot destroy a newer book**

1. Trade on device A so its `seq` advances.
2. Have device B (with an older copy) sync.

**Expect:** B's write is refused with `409 stale`; A's book survives.

❌ **Broken if:** the older book overwrites the newer one. This was a real hazard — the sync
writes unconditionally, so a client that skipped a row it could not read would overwrite it 1.5
seconds later.

---

## 15 · Automation — running strategies unattended

The newest layer, and the one where "it looks like it is working" is most dangerous.

**Enable a strategy.** `/strategies` → pick one → **Enable on <instrument>**. It starts in
**review** mode.
→ *Broken if* the panel claims nothing is placed without approval while an instance beside
it says `places automatically`. That copy was wrong once, directly above an `auto` instance.

**Watch it want something.** `/signals` shows what fired and why.
→ *Broken if* a signal appears with no reason attached, or the page implies approval is the
only thing protecting you. It should name the caps that bind an automatic order.

**See what is running.** `/automation` lists every instance across all strategies, with a
status line at the top.
→ *Broken if* it says "Running on the server" when no scheduler is running. That status must
come from a check-in that actually happened, never from a setting being switched on. With
everything paused it must say **Not running**.

**Stop something.** Each instance has **Pause** and **Delete**.
→ *Broken if* Delete goes through without asking. Pause must keep the instrument, timeframe
and parameters; only Delete may lose them.

**Let a guardrail refuse you.** `/agents` → set **MAX ORDERS / DAY** to 1, then let a
strategy try to trade again.
→ *Broken if* the refusal only appears as a toast. It must be recorded on `/orders` with its
reason, and the row must say which strategy was refused.

**Check the exits are not trapped.** With a position open, set **MAX OPEN POSITIONS** to 1.
→ *Broken if* you cannot close the position. Exposure caps apply to **opening** only — being
unable to exit the trade that breached a limit is the opposite of a risk control.

**Run it with no browser open** (optional, needs `CRON_SECRET`):

```bash
BASE_URL=http://localhost:3000 CRON_SECRET=... MAX_TICKS=3 ./scripts/scheduler.sh
```

→ *Broken if* it places an order while a tab is open. It must report
`a browser tab holds the lease` and do nothing — two writers cannot share the ledger.
→ *Broken if* a second tick re-places the same order. The same bar must not fire twice.
→ *Broken if* it trades when `USD/INR` is unavailable. It should refuse rather than price
your whole ₹ book on a fallback constant.

**Check provenance.** `/orders` has a **Placed by** column.
→ *Broken if* a strategy's order is indistinguishable from one you typed into the ticket.

---

## 16 · Learn — 135 lessons, 16 tracks

**Try to cheat a lesson.** Open any practice lesson, e.g. `/learn/run-a-strategy`.
→ *Broken if* you find a "mark as done" button anywhere. Every practice exercise is a
predicate over your actual ledger; if one can be ticked, the curriculum is decoration.

**Check a verified programme step.** `/start`.
→ *Broken if* a step labelled *checked against your account* has a checkbox. Twelve steps are
verified and must have nothing to click; six are self-marked and say so.

**Check the visuals.** Any lesson.
→ *Broken if* a lesson shows an empty framed box. Every one of the 135 has a visual, and a
blank frame means a key that resolves to no component.

---

## What is deliberately not built

Checked at [/strategies/unavailable](http://localhost:3000/strategies/unavailable). Not defects:

- **MVRV on-chain** — needs a paid feed.
- **Order-book imbalance** — live depth exists, historical L2 essentially does not. Runnable,
  never testable.
- **Triangular FX arbitrage** — needs tick bid/ask on three pairs; on delayed mid prices any
  "arbitrage" is a data artefact.
- **Dark pool sentiment**, **Fed statement NLP** — paid or low-latency feeds.
- **FII/DII flows** — NSE blocks programmatic access (verified 403).
- **Calendar spreads** — no futures curve or per-contract expiries.
- **Options backtesting on real premiums** — buildable, but no historical chain exists yet.

Also not modelled, and stated where it matters: circuit filters, ASM/GSM surveillance, market
depth, the pre-open auction, corporate-action adjustment, and tax of any kind.
