# Automated paper trading, step by step

Every screenshot below was captured by the end-to-end suite against a **real paper book**,
during a real run. Nothing here is a mockup, and nothing was staged: where a screen shows
an empty state or a refusal, that is what the app actually did at that moment.

Regenerate with:

```bash
# needs a dev server, credentials, and Playwright supplied from somewhere
node scripts/e2e.mjs && node scripts/build-walkthrough.mjs
```

> **On `npm run test:e2e`** — it still does not work. `@playwright/test` has never
> installed on this machine, so the suite runs on a separately-supplied Playwright via
> `scripts/e2e.mjs`. See `docs/AUTOMATION.md`.

---

## Orientation

### The entry point, which redirects into the terminal.

![The entry point, which redirects into the terminal.](screenshots/01-home.png)

### The terminal: live prices, chart and order ticket in one place.

![The terminal: live prices, chart and order ticket in one place.](screenshots/02-terminal.png)

### Price alerts.

![Price alerts.](screenshots/04-alerts.png)

### Broker connections and keys. Secrets never reach the browser.

![Broker connections and keys. Secrets never reach the browser.](screenshots/20-settings.png)

### Instruments you follow.

![Instruments you follow.](screenshots/25-watchlists.png)

### Watchlists persist across a reload; the instruments you follow are not session state.

![Watchlists persist across a reload; the instruments you follow are not session state.](screenshots/46-watchlists.png)

---

## Risk

### LLM-backed agents, and the guardrails that bind every automated path.

![LLM-backed agents, and the guardrails that bind every automated path.](screenshots/03-agents.png)

### Coach rules and what they have refused.

![Coach rules and what they have refused.](screenshots/11-insights.png)

### All eight guardrails. Four of these were enforced but had no control at all until recently.

![All eight guardrails. Four of these were enforced but had no control at all until recently.](screenshots/30-guardrails.png)

### The signal queue, and what actually binds an automatic order.

![The signal queue, and what actually binds an automatic order.](screenshots/31-signals.png)

### The coach scores discipline from what you actually did, and its rules can refuse an order.

![The coach scores discipline from what you actually did, and its rules can refuse an order.](screenshots/47-coach.png)

---

## Automation

### What is running, and whether anything is actually running it.

![What is running, and whether anything is actually running it.](screenshots/05-automation.png)

### What strategies want to do, and what actually binds an automatic order.

![What strategies want to do, and what actually binds an automatic order.](screenshots/21-signals.png)

### Automation status, derived from a heartbeat that actually arrived rather than from a setting.

![Automation status, derived from a heartbeat that actually arrived rather than from a setting.](screenshots/27-automation-status.png)

### Delete asks first, and points at pause — the old control destroyed tuned parameters with one silent click.

![Delete asks first, and points at pause — the old control destroyed tuned parameters with one silent click.](screenshots/28-automation-delete-confirm.png)

### The "Run it live" panel now distinguishes review from automatic instead of claiming approval is always required.

![The "Run it live" panel now distinguishes review from automatic instead of claiming approval is always required.](screenshots/29-strategy-run-it-live.png)

---

## Testing

### Comparing a strategy against buy-and-hold — the only comparison that means anything.

![Comparing a strategy against buy-and-hold — the only comparison that means anything.](screenshots/06-backtest.png)

### Portfolio backtest across sleeves, with a correlation matrix.

![Portfolio backtest across sleeves, with a correlation matrix.](screenshots/07-backtest-portfolio.png)

### Walk-forward: fit on one window, test on the next, repeatedly.

![Walk-forward: fit on one window, test on the next, repeatedly.](screenshots/08-backtest-walk-forward.png)

### A strategy compared against buy-and-hold — the only comparison that means anything.

![A strategy compared against buy-and-hold — the only comparison that means anything.](screenshots/42-backtest-result.png)

---

## Trading

### Charges itemised. Brokerage, STT, exchange, SEBI, stamp duty and GST are different things.

![Charges itemised. Brokerage, STT, exchange, SEBI, stamp duty and GST are different things.](screenshots/09-funds.png)

### Open positions and what closing them would realise.

![Open positions and what closing them would realise.](screenshots/10-holdings.png)

### Every order, including refusals and the reason each was refused.

![Every order, including refusals and the reason each was refused.](screenshots/15-orders.png)

### The paper account itself.

![The paper account itself.](screenshots/16-paper.png)

### Positions, equity curve and the record so far.

![Positions, equity curve and the record so far.](screenshots/17-portfolio.png)

### The order ticket before submitting: quantity, order value and buying power.

![The order ticket before submitting: quantity, order value and buying power.](screenshots/32-order-ticket.png)

### The Orders screen, now recording what placed each order — you, a strategy, the agent, or expiry.

![The Orders screen, now recording what placed each order — you, a strategy, the agent, or expiry.](screenshots/33-orders-provenance.png)

### The portfolio: positions, equity curve and the record so far.

![The portfolio: positions, equity curve and the record so far.](screenshots/34-portfolio.png)

### Charges itemised — brokerage, STT, exchange, SEBI, stamp duty and GST are different things with different rules.

![Charges itemised — brokerage, STT, exchange, SEBI, stamp duty and GST are different things with different rules.](screenshots/35-funds.png)

---

## Learn

### Sixteen tracks. Every practice lesson is verified against the ledger.

![Sixteen tracks. Every practice lesson is verified against the ledger.](screenshots/12-learn.png)

### Reading list.

![Reading list.](screenshots/13-library.png)

### The five-week programme. Twelve steps are checked against your ledger.

![The five-week programme. Twelve steps are checked against your ledger.](screenshots/22-start.png)

### A lesson explaining why only one runner may write the ledger.

![A lesson explaining why only one runner may write the ledger.](screenshots/26-learn-lease.png)

### A practice lesson. It cannot be completed by clicking — it reads your order book.

![A practice lesson. It cannot be completed by clicking — it reads your order book.](screenshots/43-practice-lesson.png)

### Quizzes explain why an answer is wrong rather than only scoring it.

![Quizzes explain why an answer is wrong rather than only scoring it.](screenshots/44-quiz-feedback.png)

### The five-week programme. Verified steps have no checkbox, because there is nothing to click.

![The five-week programme. Verified steps have no checkbox, because there is nothing to click.](screenshots/45-programme.png)

---

## Options

### A live NIFTY/BANKNIFTY chain with solved Greeks and IV.

![A live NIFTY/BANKNIFTY chain with solved Greeks and IV.](screenshots/14-options.png)

### The option chain. Where NSE cannot be reached it says so rather than showing an empty grid.

![The option chain. Where NSE cannot be reached it says so rather than showing an empty grid.](screenshots/48-options-chain.png)

---

## Research

### Fundamentals, earnings and IPOs — each distinguishing "no data" from "not covered".

![Fundamentals, earnings and IPOs — each distinguishing "no data" from "not covered".](screenshots/18-research.png)

### Screening the universe.

![Screening the universe.](screenshots/19-scanner.png)

---

## Strategy

### Twenty-four rule sets, each with where it makes money and where it loses it.

![Twenty-four rule sets, each with where it makes money and where it loses it.](screenshots/23-strategies.png)

### What is deliberately NOT built, and the honest reason for each.

![What is deliberately NOT built, and the honest reason for each.](screenshots/24-strategies-unavailable.png)

---

## Refusals

### An order far larger than the account can fund. The ticket shows the order value against buying power before you ever submit.

![An order far larger than the account can fund. The ticket shows the order value against buying power before you ever submit.](screenshots/36-refusal-oversized-ticket.png)

### Refusals are recorded on the Orders screen with their reason — not flashed as a toast and lost.

![Refusals are recorded on the Orders screen with their reason — not flashed as a toast and lost.](screenshots/37-refusal-recorded.png)

### The kill switch engaged. Nothing places while this is on — automatic or manual.

![The kill switch engaged. Nothing places while this is on — automatic or manual.](screenshots/38-refusal-kill-switch.png)

### The automation screen refuses to imply anything is trading while the kill switch is on.

![The automation screen refuses to imply anything is trading while the kill switch is on.](screenshots/39-refusal-kill-switch-automation.png)

### Eight strategies that are deliberately not built, each with the actual reason — a paid feed, no historical data, or a blocked source.

![Eight strategies that are deliberately not built, each with the actual reason — a paid feed, no historical data, or a blocked source.](screenshots/40-refusal-unavailable.png)

### With nothing running, the signal queue says so instead of showing placeholder rows.

![With nothing running, the signal queue says so instead of showing placeholder rows.](screenshots/41-empty-signals.png)

---

## What this run did not show

A walkthrough is only evidence of what was exercised. Anything not pictured above was not
reached by the suite, and `docs/PENDING.md` is the honest inventory of what is and is not
built.

_48 screenshots, generated from `docs/screenshots/manifest.json`._
