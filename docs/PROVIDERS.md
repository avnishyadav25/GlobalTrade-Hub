# Provider setup guide


Verified against the code on **2026-08-20**: every variable named here is one the app
actually reads. Two that this document previously told you to set —
`MARKETDATA_PROVIDER` and `MARKETDATA_API_KEY` — are read by nothing and have been
removed, along with the Twelve Data setup they belonged to. Instructions for configuring
something inert are worse than no instructions.

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

## B. Market data — mostly no key required

Most of the data layer needs **nothing configured**. Everything routes through
`cachedFetch` (TTL, single-flight, token bucket, circuit breaker); providers are never
called directly. See [MARKET-DATA.md](MARKET-DATA.md) for the per-market table.

| Source | Covers | Key needed |
|---|---|---|
| **Binance websocket** | crypto, live ticks | none (`NEXT_PUBLIC_ENABLE_BINANCE_FEED=false` to disable) |
| **Yahoo** | India, US, FX, commodities — quotes and candles | none |
| **frankfurter.app** | `USD/INR` backup when Yahoo fails | none |
| **NSE** | NIFTY / BANKNIFTY option chains | none |
| **Finnhub** | US real-time quotes, fundamentals, earnings | `FINNHUB_API_KEY` |
| **EIA** | energy inventories; one strategy is disabled without it | `EIA_API_KEY` |

`USD/INR` is load-bearing: `deriveFxRates()` prices the **entire ₹ book** from it, and the
server-side automation runner refuses to trade when only the hardcoded fallback is
available — that constant was once 14.5% wrong.

Yahoo's *search* endpoint is throttled far harder than its chart endpoint, so search has
its own 8/min budget and an exact-ticker fallback. It will IP-block on abuse; running the
end-to-end suite repeatedly is enough to trip the circuit breaker.

### Finnhub (optional)
1. https://finnhub.io → **Get free API key** → register.
2. `.env.local`: `FINNHUB_API_KEY=...`
Powers US real-time quotes, `/research`, `/api/fundamentals` and `/api/earnings`.

### EIA (optional)
1. https://www.eia.gov/opendata/register.php → request a key.
2. `.env.local`: `EIA_API_KEY=...`
Without it the inventory-shock strategy stays disabled and says so.

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
