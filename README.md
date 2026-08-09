# GlobalTrade Hub 🚀

> **One Screen, All Markets** — a unified, AxisOne-style multi-asset trading terminal for **crypto, Indian & US equities, forex and commodities**, with realistic paper trading, a backtesting lab, a market scanner and an AI trading coach.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

---

## ✨ What's inside

Six top-level sections (AxisOne **Direction B — Terminal Dark** design, with a light theme):

| Section | What it does |
|---|---|
| **Terminal** | 3-pane pro layout: multi-market watchlist · live candlestick chart · order ticket. Positions / Orders / History tabs. Paper ↔ Live toggle. |
| **Backtest** | Strategy builder (EMA crossover + RSI filter, stop/target, % sizing) run over historical candles → net return, win rate, profit factor, max drawdown, Sharpe, equity curve, drawdown & monthly-returns heatmap. |
| **Paper** | Session banner (equity, today/open P&L, trades, win-rate), equity curve, open positions, recent fills, and a paper order ticket. |
| **Portfolio** | One balance sheet across all 5 markets — stat cards, allocation donut, value curve, holdings table (valued live). |
| **Insights** | AI Trading Coach — discipline score, detected behaviour patterns, **rules you can apply that are enforced at order time**, discipline breakdown, and an emotion-tagged trade journal. |
| **Scanner** | Screen every market (gainers/losers, RSI extremes, breakouts) → send a hit straight to the order ticket. |

### Trading engine

- **Realistic + persistent paper engine** (`src/lib/paperEngine.ts`): market / limit / stop / stop-limit orders, **resting orders, partial fills, slippage, fees, margin**, multi-currency account (₹ base, USD converted). State persists across reloads.
- **Live market data** (`src/stores/marketStore.ts`): realistic random-walk simulation by default, with a **real Binance WebSocket feed** seam (`NEXT_PUBLIC_ENABLE_BINANCE_FEED=true`).
- **Connectors** (`src/lib/brokers/registry.ts` + `src/app/api/brokers/*`): Zerodha Kite, Dhan, Alpaca, Binance, Coinbase, Interactive Brokers and an FX/commodity data provider — behind a unified interface with a **paper ↔ live** toggle. **Broker keys are POSTed to the server and never stored in the browser** (meant for Supabase Vault).
- **AI Coach** (`src/app/api/coach/route.ts`): uses the **Claude API** server-side when `ANTHROPIC_API_KEY` is set; otherwise a deterministic heuristic coach.

---

## 🚀 Quick start

```bash
cd app
npm install
npm run dev          # http://localhost:3000  → redirects to /terminal
```

The app is **fully functional with no configuration** — simulated live prices + local paper engine. Add environment variables to light up the backend, real feeds, live trading and the AI coach.

```bash
cp .env.example .env.local   # then fill in what you need
```

| Variable | Enables |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth + persistence |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side secret storage (Vault) — **never exposed to the browser** |
| `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL`) | Claude-powered AI coach |
| `NEXT_PUBLIC_ENABLE_BINANCE_FEED=true` | Live crypto prices via Binance WS |
| `MARKETDATA_API_KEY` | FX / commodity real data |

Broker API keys are entered in-app (**Settings → Connections**), not in `.env`.

---

## 🗄️ Supabase backend (optional)

Schema lives in [`supabase/migrations/0001_globaltrade_hub.sql`](supabase/migrations/0001_globaltrade_hub.sql) — every table is prefixed `gth_`, per-user, with **Row Level Security**. Apply it to a **dedicated** Supabase project:

```bash
supabase db push        # or run the SQL via the Supabase dashboard / MCP
```

Broker secrets belong in **Supabase Vault**, referenced by `gth_broker_connections.vault_secret_name`; server API routes read them with the service-role key. Until Supabase is configured, the app persists to `localStorage`.

---

## 🏗️ Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 (CSS-first `@theme`), Hanken Grotesk + IBM Plex Mono |
| State | Zustand (persisted) |
| Charts | Custom SVG (`src/components/charts`) |
| Backend | Supabase (auth · Postgres · Vault) — optional |
| AI | Claude API (server-side) — optional |

### Project structure

```
app/src/
├── app/                 # routes: terminal, backtest, paper, portfolio, insights, scanner, settings, auth, api/*
├── components/
│   ├── charts/          # SVG area, donut, ring, heatmap, candlestick…
│   ├── terminal/        # Watchlist, OrderTicket, PositionsPanel, TerminalChart
│   ├── layout/          # TopBar
│   └── system/          # MarketEngine (drives sim + paper matching)
├── lib/
│   ├── paperEngine.ts   # realistic paper matching engine
│   ├── backtestEngine.ts, scanner.ts, coach.ts
│   ├── brokers/         # registry + adapters
│   ├── marketData/      # binance feed
│   └── supabase/        # gated client + server
└── stores/              # market, paper, ui, coach, connections (Zustand)
```

---

## ⚠️ Disclaimer

This is a technology platform, not a registered investment advisor. Trading involves substantial risk of loss. **Live order routing is built and secured server-side but should be validated only in sandbox/paper mode until you connect and test your own broker accounts.** Paper-trading results may differ from live trading.

---

<p align="center">Made for traders — one screen, all markets.</p>
