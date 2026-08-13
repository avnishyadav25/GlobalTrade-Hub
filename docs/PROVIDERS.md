# Provider setup guide


> **Staleness warning.** This document predates the options layer, walk-forward and
> portfolio backtesting, and the current provider set. See [PENDING.md](PENDING.md) for
> what is actually true today.

Everything here is **optional** — GlobalTrade Hub runs with simulated data, a local
paper engine, and a heuristic coach out of the box. Add keys to unlock real data,
live trading, the AI agents, and notifications. All keys live in `app/.env.local`
(never committed); broker keys are entered in **Settings → Connections**.

---

## A. AI / LLM providers (item 3)

DeepSeek is the default and the cheapest. Set **one** key minimum.

### DeepSeek (default, recommended)
1. Go to https://platform.deepseek.com → sign up.
2. **API Keys** → *Create new key* → copy.
3. `.env.local`: `DEEPSEEK_API_KEY=sk-...` (and `LLM_PROVIDER=deepseek`).
Pricing: very low (~$0.14 / 1M input tokens). Small starting credit.

### OpenAI / Gemini / Anthropic (optional alternatives)
- **OpenAI:** https://platform.openai.com/api-keys → create → `OPENAI_API_KEY`.
- **Gemini:** https://aistudio.google.com/app/apikey → *Create API key* (free tier) → `GEMINI_API_KEY`.
- **Anthropic:** https://console.anthropic.com/settings/keys → `ANTHROPIC_API_KEY`.
Switch the active one with `LLM_PROVIDER=` or per-run in the **Agents** page.

---

## B. FX / commodity market data (item 6) — free tiers

Pick one; set `MARKETDATA_PROVIDER` + `MARKETDATA_API_KEY`.

### 1) Twelve Data — recommended (best free coverage)
1. https://twelvedata.com → **Sign up** (free).
2. Dashboard → **API Keys** → copy your key.
3. `.env.local`: `MARKETDATA_PROVIDER=twelvedata`, `MARKETDATA_API_KEY=...`
Free: ~800 requests/day, 8/min. Covers `EUR/USD`, `XAU/USD`, `XAG/USD`, `WTI/USD`, etc.

### 2) Finnhub — good forex backup
1. https://finnhub.io → **Get free API key** → register.
2. Dashboard → copy key. Free tier, forex + some commodities.

### 3) Alpha Vantage — instant, low limit (fallback)
1. https://www.alphavantage.co/support/#api-key → enter email → instant key.
2. Free: 25 requests/day (fine as a fallback). Covers FX + WTI/Brent/gold.

> The app polls `GET /api/marketdata` server-side; if no key is set those
> instruments keep simulating so nothing breaks.

---

## C. Live broker / paper trading (item 7) — free & paper

Enter these in **Settings → Connections** (stored server-side). Start with paper/sandbox.

### 1) Alpaca — best free paper (US stocks)
1. https://alpaca.markets → sign up.
2. Toggle to **Paper Trading** (top-left of the dashboard).
3. **Generate API Keys** → copy *API Key ID* + *Secret Key*.
4. In app: Connections → Alpaca → mode **Paper** → paste keys.
Free, unlimited paper trading.

### 2) Binance — free crypto testnet
1. https://testnet.binance.vision → **Log in with GitHub**.
2. **Generate HMAC_SHA256 Key** → copy key + secret.
3. In app: Connections → Binance → mode **Paper** → paste.
Free. (For live, create keys at https://www.binance.com → API Management.)

### 3) Dhan — free live API (India)
1. Open a Dhan account → https://dhanhq.co.
2. Web → **DhanHQ / API Access** → generate **Access Token** + note your **Client ID**.
3. In app: Connections → Dhan → paste Client ID + Access Token.
Free API. (Zerodha **Kite Connect** is an alternative but costs ₹2,000/month.)

> Live order routing also requires `SUPABASE_SERVICE_ROLE_KEY` (to store secrets in
> Vault) and the per-broker adapter enabled. Until then, auto-live safely degrades to paper.

---

## D. Notifications (item 9) — Telegram → Email → WhatsApp

### 1) Telegram (easiest, free) — do this first
1. In Telegram, message **@BotFather** → `/newbot` → follow prompts → copy the **bot token**.
2. Message your new bot once (say "hi"), then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy the `chat.id` from the JSON.
3. `.env.local`: `TELEGRAM_BOT_TOKEN=...`, `TELEGRAM_CHAT_ID=...`
4. Settings → Notifications → **Send test notification**.

### 2) Email (Resend, free tier)
1. https://resend.com → sign up → **API Keys** → create → `RESEND_API_KEY`.
2. Verify a sending domain (or use the onboarding sandbox sender).
3. `.env.local`: `EMAIL_FROM=alerts@yourdomain.com`, `EMAIL_TO=you@example.com`.

### 3) WhatsApp (Twilio) — heaviest, has cost
1. https://twilio.com → sign up → enable the **WhatsApp sandbox** (or a approved sender).
2. Copy **Account SID** + **Auth Token**; note the sandbox **from** number.
3. `.env.local`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM=whatsapp:+1...`, `WHATSAPP_TO=whatsapp:+91...`.
Note: production WhatsApp needs Meta/Twilio business approval and is billed per message.

---

## E. Scheduling the daily briefing

Point a scheduler at `GET /api/cron/tick?secret=<CRON_SECRET>`:
- **Vercel Cron:** add to `vercel.json` → `{ "crons": [{ "path": "/api/cron/tick?secret=...", "schedule": "30 3 * * *" }] }` (UTC).
- **Supabase pg_cron:** `select cron.schedule('gth-brief','30 3 * * *', $$ select net.http_get('https://<app>/api/cron/tick?secret=...') $$);`
