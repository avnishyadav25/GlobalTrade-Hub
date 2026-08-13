# GlobalTrade Hub — Full Documentation


> **Staleness warning.** This document predates the options layer, walk-forward and
> portfolio backtesting, and the current provider set. See [PENDING.md](PENDING.md) for
> what is actually true today.

One screen, all markets. A multi-asset trading terminal (crypto, Indian & US
equities, forex, commodities) with a realistic paper engine, backtesting, a market
scanner, multi-provider AI agents (DeepSeek default), auto-trading, notifications,
and an optional Supabase backend.

> The app runs with **zero configuration** (simulated data + local paper engine +
> heuristic coach). Every integration below is optional and degrades gracefully.

---

## Table of contents
1. [What was built](#1-what-was-built)
2. [Architecture](#2-architecture)
3. [Quick start](#3-quick-start)
4. [Environment variables](#4-environment-variables)
5. [Get your keys — AI providers](#5-get-your-keys--ai-providers)
6. [Get your keys — market data (FX/commodities)](#6-get-your-keys--market-data-fxcommodities)
7. [Get your keys — trading platforms (LIVE + paper)](#7-get-your-keys--trading-platforms-live--paper)
8. [Get your keys — notifications](#8-get-your-keys--notifications)
9. [Supabase backend](#9-supabase-backend)
10. [How to test — end to end](#10-how-to-test--end-to-end)
11. [Deployment](#11-deployment)
12. [What you need to do / what is pending](#12-what-you-need-to-do--what-is-pending)
13. [Security](#13-security)

---

## 1. What was built

**Screens (7 sections + settings + auth)**
- **Terminal** — 3-pane: multi-market watchlist · live candlestick chart · order ticket (market/limit/SL, value/margin/charges), with Positions/Orders/History and a Paper↔Live toggle.
- **Backtest** — EMA-crossover + RSI strategy engine over historical candles → net return, win rate, profit factor, max drawdown, Sharpe, equity curve, drawdown, monthly-returns heatmap.
- **Paper** — session banner (equity, P&L, trades, win-rate), equity curve, open positions, recent fills, order ticket.
- **Portfolio** — stat cards, allocation donut across 5 markets, value curve, live-valued holdings.
- **Insights** — AI Trading Coach: discipline score, detected behaviour patterns, enforceable rules, discipline breakdown, mood-tagged journal.
- **Scanner** — filters (gainers/losers, RSI extremes, breakouts) → send a hit to the order ticket.
- **Agents** — control panel: LLM provider, trading mode (manual/auto-paper/auto-live), guardrails, kill-switch; run signals/briefing/scanner/journal agents.
- **Settings** — broker connections, notifications (test-send), theme, paper reset, sign out.

**Engine & data**
- Realistic **paper engine** (`lib/paperEngine.ts`): market/limit/stop/stop-limit, resting orders, partial fills, slippage, fees, margin, multi-currency (₹ base), priced against live quotes; persistent.
- **Market data** (`stores/marketStore.ts`): Binance public WebSocket for crypto (on by default) + simulation for the rest; server route for FX/commodity providers.
- **Backtest** (`lib/strategies/backtest.ts`), **Scanner** (`lib/scanner.ts`).

**AI (server-side, multi-provider)**
- `lib/ai/index.ts` — `runLLM()` with **DeepSeek default**, + OpenAI / Gemini / Anthropic, automatic fallback, heuristic when no key.
- Agents (`lib/ai/agents.ts`): trading-signal, journal-writer, daily-briefing, NL-scanner + the coach.
- **Auto-trading** (`components/system/AgentEngine.tsx` + `stores/agentStore.ts`): manual / auto-paper / auto-live with guardrails (max order value, daily loss, open positions, min confidence), kill-switch, and coach-rule enforcement.

**Backend & platform**
- **Super-admin auth** (`lib/auth.ts`, `middleware.ts`): signed-cookie session from `.env` creds.
- **Supabase** (optional): `gth_*` tables + RLS, plus `gth_app_state` KV for full cloud sync of the client stores.
- **Notifications** (`lib/notify/*`): Telegram, Email (Resend), WhatsApp (Twilio).
- **Connectors** (`lib/brokers/registry.ts` + `/api/brokers/*`): Zerodha, Dhan, Alpaca, Binance, Coinbase, IBKR, FX/commodity provider — server-proxied; keys never in the browser.

---

## 2. Architecture

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind v4 (CSS-first), Hanken Grotesk + IBM Plex Mono |
| State | Zustand (persisted) + Supabase cloud sync |
| Charts | Custom SVG (`components/charts`) |
| AI | DeepSeek / OpenAI / Gemini / Anthropic (server-side) |
| Backend | Supabase (Postgres + RLS + Vault) — optional |

```
app/src/
├── app/
│   ├── (routes) terminal, backtest, paper, portfolio, insights, scanner, agents, settings, auth
│   └── api/  auth/login · coach · agents/[agent] · brokers/connect · brokers/[broker]/order
│             · notify · marketdata · state/[key] · cron/tick
├── components/  charts/ · terminal/ · layout/ · system/ (MarketEngine, AgentEngine, CloudSync)
├── lib/  paperEngine · backtestEngine · scanner · coach · format · auth
│         ai/ (index, agents, types) · brokers/ (registry, adapters) · notify/ · supabase/ · marketData/
└── stores/  market · paper · ui · coach · connections · agent
supabase/migrations/  0001_globaltrade_hub.sql · 0002_app_state.sql
docs/  DOCUMENTATION.md · PROVIDERS.md
```

**Data flow:** `MarketEngine` streams quotes → `paperEngine` matches resting orders →
stores update UI → `CloudSync` mirrors stores to Supabase. `AgentEngine` polls the
signals agent and executes under guardrails. All AI/broker/notify calls run in API
routes so secrets stay server-side.

---

## 3. Quick start

```bash
git clone <repo> && cd GlobalTrade-Hub/app
npm install
cp .env.example .env.local      # optional — fill in what you want
npm run dev                     # http://localhost:3000  → /terminal
```

Build / lint:
```bash
npm run build
npm run lint
```

---

## 4. Environment variables

All optional; the app runs without them. Put them in `app/.env.local` (git-ignored).

| Variable | Purpose |
|---|---|
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | App login (super-admin). Unset = open demo mode. |
| `AUTH_SECRET` | Signs the session cookie (any long random string). |
| `ADMIN_USER_ID` | UUID used as the owner for Supabase rows. |
| `LLM_PROVIDER` | `deepseek` (default) / `openai` / `gemini` / `anthropic`. |
| `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | LLM keys (set at least one). |
| `NEXT_PUBLIC_ENABLE_BINANCE_FEED` | `true` (default) real crypto WS; `false` = pure sim. |
| `MARKETDATA_PROVIDER`, `MARKETDATA_API_KEY` | FX/commodity quotes. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side writes + Vault. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Telegram notifications. |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TO` | Email notifications. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `WHATSAPP_TO` | WhatsApp. |
| `CRON_SECRET` | Secures `/api/cron/tick`. |

Broker keys are **not** here — enter them in **Settings → Connections**.

---

## 5. Get your keys — AI providers

**DeepSeek (default, cheapest — recommended)**
1. https://platform.deepseek.com → sign up.
2. **API Keys → Create new key** → copy.
3. `.env.local`: `LLM_PROVIDER=deepseek`, `DEEPSEEK_API_KEY=sk-...`

**OpenAI** — https://platform.openai.com/api-keys → create → `OPENAI_API_KEY`.
**Gemini** — https://aistudio.google.com/app/apikey → *Create API key* (free tier) → `GEMINI_API_KEY`.
**Anthropic** — https://console.anthropic.com/settings/keys → `ANTHROPIC_API_KEY`.

Switch the active provider with `LLM_PROVIDER` or per-run on the **Agents** page.

---

## 6. Get your keys — market data (FX/commodities)

Pick one; set `MARKETDATA_PROVIDER` + `MARKETDATA_API_KEY`.

1. **Twelve Data (recommended)** — https://twelvedata.com → sign up → **API Keys** → copy. Free ~800 req/day; covers `EUR/USD`, `XAU/USD`, `XAG/USD`, `WTI/USD`.
2. **Finnhub** — https://finnhub.io → register → copy key. Free forex.
3. **Alpha Vantage** — https://www.alphavantage.co/support/#api-key → instant key. Free 25 req/day (fallback).

Crypto needs no key (Binance public WS). Indian & US equity live quotes come from
your connected broker (below); without one they simulate.

---

## 7. Get your keys — trading platforms (LIVE + paper)

Enter these in **Settings → Connections** (sent to the server, never stored in the
browser). Start with **paper/sandbox**; move to live only after testing.

> Live order routing adapters are scaffolded (`/api/brokers/[broker]/order`) but not
> yet fully implemented per broker — see [pending](#12). Paper trading is fully live now.

### Crypto

**Binance — Testnet (free, paper)**
1. https://testnet.binance.vision → **Log in with GitHub**.
2. **Generate HMAC_SHA256 Key** → copy API key + secret.
3. Settings → Connections → Binance → **Paper** → paste.

**Binance — Live**
1. https://www.binance.com → **Account → API Management**.
2. **Create API** → label it → complete 2FA.
3. Enable **Enable Spot & Margin Trading**; set an **IP access restriction** (recommended).
4. Copy API key + secret → Settings → Binance → **Live**.

**Coinbase — Live**
1. https://www.coinbase.com/settings/api (or Advanced Trade / CDP portal https://portal.cdp.coinbase.com).
2. **New API key** → choose portfolio + permissions (view/trade) → create.
3. Copy the key name + private key → Settings → Coinbase.

### US equities

**Alpaca — Paper (free)**
1. https://alpaca.markets → sign up.
2. Toggle **Paper Trading** (top-left).
3. **Generate API Keys** → copy *API Key ID* + *Secret Key*.
4. Settings → Alpaca → **Paper**.

**Alpaca — Live**
1. Complete brokerage onboarding + fund the account (approval required).
2. Switch to **Live Trading** → generate live keys → Settings → Alpaca → **Live**.

### India (NSE/BSE)

**Dhan — Live API (free)**
1. Open a Dhan account → https://dhanhq.co.
2. Web → **Profile → DhanHQ / Access DhanHQ APIs**.
3. Generate an **Access Token** (choose validity) and note your **Client ID**.
4. Settings → Dhan → paste Client ID + Access Token.

**Zerodha — Kite Connect (paid, ~₹500/month per app)**
1. https://developers.kite.trade → **Create new app** (type: Connect).
2. Note **API key** + **API secret**; set a redirect URL.
3. Subscribe to Kite Connect (billing in the dev console).
4. Daily login flow yields a `request_token` → exchange for an **access token** (regenerated daily).
5. Settings → Zerodha Kite → paste API key + secret + access token.

**Alternatives (India):** Fyers (free API — https://myapi.fyers.in), Upstox
(https://upstox.com/developer), AngelOne SmartAPI (free — https://smartapi.angelbroking.com).

### Multi-asset / FX / commodities

**Interactive Brokers (paper + live)**
1. Open an IBKR account (a **paper account** is included).
2. Download & run the **Client Portal Gateway** (or TWS API) locally and log in.
3. In Settings → Interactive Brokers, set the **gateway URL** (e.g. `https://localhost:5000`).
   Paper = your IBKR paper account; live = funded account.

**FX/commodity data** — see [section 6](#6-get-your-keys--market-data-fxcommodities)
(Twelve Data etc.). For a dedicated FX broker demo, **OANDA** offers a free practice
API token at https://www.oanda.com (fxTrade Practice → Manage API Access).

---

## 8. Get your keys — notifications

**Telegram (do this first — free)**
1. In Telegram, message **@BotFather** → `/newbot` → copy the **bot token**.
2. **Open your bot and press Start** (bots cannot message you until you initiate — this is why an untouched bot returns HTTP 403).
3. Get your chat id: open `https://api.telegram.org/bot<TOKEN>/getUpdates` after messaging the bot → copy `result[].message.chat.id`.
4. `.env.local`: `TELEGRAM_BOT_TOKEN=...`, `TELEGRAM_CHAT_ID=...`
5. Settings → Notifications → **Send test notification**.

**Email (Resend, free tier)**
1. https://resend.com → **API Keys** → create → `RESEND_API_KEY`.
2. Verify a domain (or use the onboarding sender) → set `EMAIL_FROM`, `EMAIL_TO`.

**WhatsApp (Twilio)**
1. https://twilio.com → enable the **WhatsApp sandbox** (or an approved sender).
2. Copy **Account SID** + **Auth Token**, note the sandbox from-number.
3. `.env.local`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM=whatsapp:+1...`, `WHATSAPP_TO=whatsapp:+91...`
   (Production WhatsApp needs Meta/Twilio business approval and is billed per message.)

---

## 9. Supabase backend

1. Create a **dedicated** project at https://supabase.com (free plan).
2. **Project Settings → API** → copy: Project URL, `anon` key, `service_role` key →
   `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
3. **SQL Editor** → paste & run, in order:
   - `supabase/migrations/0001_globaltrade_hub.sql`
   - `supabase/migrations/0002_app_state.sql`
4. Restart the app. The stores (paper, agents, coach, connections, ui) now sync to
   `gth_app_state` and survive reloads/devices. Without Supabase, everything persists
   to `localStorage` instead.

Broker secrets belong in **Supabase Vault** (referenced by
`gth_broker_connections.vault_secret_name`); server routes read them with the
service-role key.

---

## 10. How to test — end to end

Run `npm run dev`, then:

| # | Test | Steps | Expected |
|---|---|---|---|
| 1 | **Login** | Set `ADMIN_EMAIL/PASSWORD`, open the app | Redirect to `/auth/login`; correct creds → `/terminal`; wrong creds rejected |
| 2 | **Live crypto** | Open Terminal, watch BTC/USDT | Price ticks from Binance WS (not frozen) |
| 3 | **Paper trade** | Terminal → Buy (market) | Position appears; P&L updates live |
| 4 | **Resting order** | Place a limit far from price, then near | Sits in Orders → fills when price crosses; partial fills possible |
| 5 | **Persistence** | Place a trade, hard-reload / other browser | State restores (Supabase) or persists locally |
| 6 | **Backtest** | Backtest → Run | Metrics + equity/drawdown/heatmap render |
| 7 | **AI coach** | Insights → Refresh with AI | `source: ai` via DeepSeek; patterns + summary |
| 8 | **Agents** | Agents → Run signals / briefing / scanner | Signals list (Trade→ applies); briefing text; scanner routes with criteria |
| 9 | **Auto-paper** | Agents → mode `auto-paper` (kill-switch off) | Within ~60s, signals auto-execute in paper under guardrails; toast + Telegram |
| 10 | **Guardrails** | Set min-confidence high / kill-switch on | No auto orders; kill-switch halts everything |
| 11 | **Notifications** | Settings → Notifications → Send test | Message arrives in Telegram (after bot Start) / email |
| 12 | **Scanner** | Scanner → preset + market filter → Trade→ | Filtered rows; Trade→ prefills the Terminal ticket |

API smoke tests:
```bash
curl -s localhost:3000/api/notify                       # {"channels":[...]}
curl -s -X POST localhost:3000/api/coach -H 'content-type: application/json' \
  -d '{"stats":{"tradesAnalyzed":5,"winRate":50,"avgRR":1.4},"recent":[]}'   # source: ai|heuristic
curl -s "localhost:3000/api/cron/tick?secret=$CRON_SECRET"   # briefing → notify
```

> Note: a locked-down network (corporate proxy/allowlist) can block outbound calls
> to DeepSeek/Telegram/Supabase. Test on a normal network or your deployment.

---

## 11. Deployment

**Vercel (recommended)**
1. Import the repo; set the project root to `app/`.
2. Add all env vars (Settings → Environment Variables).
3. Deploy. Add a cron in `app/vercel.json`:
   ```json
   { "crons": [ { "path": "/api/cron/tick?secret=YOUR_SECRET", "schedule": "30 3 * * *" } ] }
   ```
   (03:30 UTC daily briefing.)

**Supabase pg_cron alternative**
```sql
select cron.schedule('gth-brief','30 3 * * *',
  $$ select net.http_get('https://<your-app>/api/cron/tick?secret=YOUR_SECRET') $$);
```

---

## 12. What you need to do / what is pending

**You (to go fully live):**
- [ ] Add Supabase `anon` + `service_role` keys to `.env.local`.
- [ ] Run `0001` + `0002` SQL in the Supabase SQL editor.
- [ ] Press **Start** on your Telegram bot; set `TELEGRAM_CHAT_ID`.
- [ ] Add a DeepSeek key (already provided) → AI on.
- [ ] (Optional) Market-data provider key; broker keys (paper first).
- [ ] Deploy to Vercel + set env + cron.

**Pending in code (roadmap):**
- **Live broker order execution** — `/api/brokers/[broker]/order` returns 501 today; auto-live safely degrades to paper. Next: implement each broker SDK (Alpaca, Binance, Dhan, Kite, IBKR) reading credentials from Vault.
- **Relational persistence** — cloud sync uses the `gth_app_state` KV blob; the relational tables (`gth_orders/fills/journal/…`) exist but aren't populated yet.
- **India/US live quotes** — currently simulated unless a broker feed is connected (crypto is real via Binance).
- **WhatsApp** — adapter ready; needs Twilio/Meta business approval to send.
- **Real Supabase Auth (multi-user)** — currently single super-admin via env.

---

## 13. Security

- Secrets live only in `.env.local` (git-ignored) and server-side env — never in the client bundle. Broker keys go through server routes / Supabase Vault.
- Rotate any key shared over chat/email.
- `auto-live` trades real money: it requires an armed live connection + guardrails + kill-switch, and defaults to **manual**. Validate in paper first.
- This is a technology platform, not investment advice. Trading involves risk of loss.
