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

### The terminal: live prices, the chart, and the order ticket.

![The terminal: live prices, the chart, and the order ticket.](screenshots/01-terminal.png)

---

## Learn

### A lesson explaining why only one runner may write the ledger.

![A lesson explaining why only one runner may write the ledger.](screenshots/02-learn-lease.png)

---

## Automation

### Automation status, derived from a heartbeat that actually arrived rather than from a setting.

![Automation status, derived from a heartbeat that actually arrived rather than from a setting.](screenshots/03-automation-status.png)

### Delete asks first, and points at pause — the old control destroyed tuned parameters with one silent click.

![Delete asks first, and points at pause — the old control destroyed tuned parameters with one silent click.](screenshots/04-automation-delete-confirm.png)

### The "Run it live" panel now distinguishes review from automatic instead of claiming approval is always required.

![The "Run it live" panel now distinguishes review from automatic instead of claiming approval is always required.](screenshots/05-strategy-run-it-live.png)

---

## Risk

### All eight guardrails. Four of these were enforced but had no control at all until recently.

![All eight guardrails. Four of these were enforced but had no control at all until recently.](screenshots/06-guardrails.png)

### The signal queue, and what actually binds an automatic order.

![The signal queue, and what actually binds an automatic order.](screenshots/07-signals.png)

---

## Trading

### The order ticket before submitting: quantity, order value and buying power.

![The order ticket before submitting: quantity, order value and buying power.](screenshots/08-order-ticket.png)

### The Orders screen, now recording what placed each order — you, a strategy, the agent, or expiry.

![The Orders screen, now recording what placed each order — you, a strategy, the agent, or expiry.](screenshots/09-orders-provenance.png)

### The portfolio: positions, equity curve and the record so far.

![The portfolio: positions, equity curve and the record so far.](screenshots/10-portfolio.png)

### Charges itemised — brokerage, STT, exchange, SEBI, stamp duty and GST are different things with different rules.

![Charges itemised — brokerage, STT, exchange, SEBI, stamp duty and GST are different things with different rules.](screenshots/11-funds.png)

---

## What this run did not show

A walkthrough is only evidence of what was exercised. Anything not pictured above was not
reached by the suite, and `docs/PENDING.md` is the honest inventory of what is and is not
built.

_11 screenshots, generated from `docs/screenshots/manifest.json`._
