# Market data — where every price comes from

Everything below was **verified live on 2026-08-10**, not taken from provider marketing.

## The short answer

You need **no API keys at all** for working prices in every market. Yahoo Finance covers the
entire instrument universe keylessly. Keys only buy you *lower latency*, not coverage.

| Market | Provider | Key needed | Latency | Verified |
|---|---|---|---|---|
| **Crypto** | Binance public REST + WebSocket | no | real-time | BTC/ETH/SOL streaming |
| **US equities** | Finnhub free tier | `FINNHUB_API_KEY` | **real-time** | AAPL 306.49 |
| US (fallback) | Yahoo v8 chart | no | ~15 min | AAPL 306.64 |
| **India (NSE)** | Yahoo v8 chart, `.NS` / `^NSEI` | no | **~15 min delayed** | RELIANCE ₹1,327.30 · NIFTY 24,583.80 |
| **Forex** | Yahoo, `EURUSD=X` / `JPY=X` | no | ~15 min | EUR/USD 1.1554 · USD/JPY 158.88 |
| **Commodities** | Yahoo futures, `GC=F` / `SI=F` / `CL=F` | no | ~15 min | Gold 4,383.50 · WTI 80.75 |
| **USD/INR** | Yahoo `USDINR=X`, then frankfurter.app | no | ~15 min | **95.29** |

## The one that matters most: USD/INR

Base currency is INR, so **every USD-quoted position is converted through this rate**. The engine
used to fall back to a hardcoded `83.2` — against a real rate of ~95.3, that mispriced the entire
₹ book by **14.5%**.

It now comes live from Yahoo (`USDINR=X`), with `frankfurter.app` as a keyless second source and a
last-known-good cache so an outage doesn't snap the book back to a constant. If both fail, the
fallback constant is used and the UI says *"fallback rate — no live USD/INR quote"*.

## India: the honest position

**There is no free real-time NSE/BSE feed without a broker account.** Your options:

1. **Yahoo (what's wired)** — free, keyless, covers NSE via `.NS`. Delayed 15–20 minutes.
   Unofficial, so it can rate-limit or IP-block; the app caches, rate-limits and circuit-breaks it.
2. **Dhan / ICICI Breeze** — real-time and free, but requires a funded demat account. Connect in
   Settings → Connections.
3. **Zerodha Kite Connect** — ₹2,000/month, real-time tick data.

The header badge shows **DELAYED** whenever any market is behind, and hovering it lists each
market's provider and lag. Do not trade live off delayed Indian prices.

## Keys you have, and what they're worth

| Env var | Status | Notes |
|---|---|---|
| `FINNHUB_API_KEY` | **wired, working** | Real-time US equities. Free tier returns **403 for forex and Indian tickers** — so the app only asks it for US symbols. |
| `ALPACA_PAPER_TRADING_*` | wired for broker orders | Also usable for US bars (IEX feed ≈ 2% of consolidated volume). |
| `MARKETDATA_API_KEY` (Twelve Data) | **returns 401 — no longer used** | The key is 33 hex characters; Twelve Data keys are 32. Likely a stray character. **It no longer matters**: Yahoo covers everything Twelve Data did, keylessly and without the 800/day cap. Re-add it only if you want a second commodity source. |
| `ALPHA_VANTAGE_API_KEY` | not wired | Works, but the free tier is ~25 requests/day and rate-limits aggressively. Yahoo is strictly better here. |

## How the app protects the free tiers

The old code polled Twelve Data every 15 seconds — **5,760 requests/day against an 800/day limit**
— and only stopped when the provider was unconfigured, never on a 429. That is fixed:

- **60-second poll**, paused entirely while the browser tab is hidden, refreshing on return.
- **TTL cache** per provider (crypto 10s, US 15s, Yahoo quotes 90s, candles 5min, FX 15min).
- **Single-flight** — three open tabs make one upstream call, not three.
- **Token bucket** per provider (Yahoo 30/min, Finnhub 50/min, Binance 120/min).
- **Circuit breaker** — three consecutive failures pauses that provider for 5 minutes and the
  router falls through to the next one.
- **Stale-while-limited** — if the bucket is empty, the last cached price is served rather than a gap.

## Watchlists larger than the budget

Yahoo's bucket is 30/min and `yahoo.quotes` makes **one upstream call per symbol**. That bucket is
shared with candle loads and instrument search, and ~11/min already goes on the seeded instruments
plus USD/INR — so real headroom is around **16/min, not 30**. A 40-symbol watchlist polled every
60 seconds would ask for 40.

Raising the limit is not an option: Yahoo is unofficial and blocks by IP, and one ban takes out
India, FX, commodities, USD/INR *and* the US fallback at once. Instead `lib/marketData/priority.ts`
splits the universe:

| Tier | Contents | Refresh |
|---|---|---|
| **Hot** | selected symbol, open positions, resting orders, armed alerts | every cycle, always |
| **Rotation** | active list first, then everything else | sequential, 18 Yahoo-bound symbols per cycle |

A full rotation therefore takes `ceil(scarce symbols ÷ 18)` minutes — 2 minutes at 36 symbols,
4 at 60. Rotation is strictly sequential rather than "skip what doesn't fit", so no symbol can
starve. A server-side clamp of 40 symbols per request guards against a buggy client independently.

## Saying how old a price is

`ProviderQuote` carries `at` — when the value was fetched **upstream**, not when it was served.
This matters because `cachedFetch` deliberately serves stale data once a bucket is empty; without
`at`, a ten-minute-old price arrived stamped with the current time.

`lib/marketData/staleness.ts` turns that into one of five states:

| State | Meaning | Rendered as |
|---|---|---|
| `live` | real-time feed, recently updated | normal |
| `delayed` | provider is delayed by design (Yahoo equities) | normal; the header badge carries the lag |
| `stale` | older than 3 poll cycles (30s for crypto) | dimmed, captioned `4m ago` |
| `queued` | rotation deliberately skipped it this cycle | dimmed, captioned `queued` |
| `none` | **no real price has ever arrived** | em-dash — never a number |

That last row is the important one. The watchlist used to fall back to `asset.price` from the
catalog constant, which has RELIANCE at **₹2,945.60** against a live ~₹1,327 — a confident wrong
number rather than an honest gap. Nothing renders a catalog price as if it were market data now,
and `marketStore`'s 1 Hz simulation refuses to animate over any symbol that has a real quote.

## User-added instruments

The instrument registry (`lib/instruments.ts`) is **client-only module state** — every
`registerInstruments()` call site runs in the browser. On the server it holds exactly the 16 seeds,
so `router.fetchQuotes` silently dropped anything else and `/api/marketdata/candles` answered
`400 unknown symbol`.

`lib/marketData/universe.ts` resolves per request instead: the client sends its symbols plus
descriptors for non-seeded instruments, and the server validates them without ever writing to the
shared registry. Rules that matter:

- a descriptor can **never override a seed** — a request cannot relabel RELIANCE as crypto/USD;
- an unknown symbol with no descriptor is **dropped and reported**, never defaulted to crypto/USD;
- bad symbols degrade into a `skipped` map rather than failing the whole request, so one malformed
  row from stale localStorage cannot blank the board or kill the USD/INR rate.

The cron tick has no browser to ask, so it reads the persisted watchlist from `gth_app_state`
(`lib/marketData/watchlistState.ts`) and falls back to the seeds for a user who has never synced.

## Fallback order

```
crypto     binance  →  yahoo
us         finnhub  →  yahoo
india      yahoo    →  (synthetic, clearly labelled)
forex      yahoo    →  (synthetic)
commodity  yahoo    →  (synthetic)
```

When no provider covers a symbol, historical candles fall back to a **generated** series — and the
Backtest screen labels the run *"This is not a historical backtest"* rather than presenting
generated numbers as evidence. The generator uses driftless GBM with per-market annualised
volatility (crypto 60%/yr, US 25%, India 22%, FX 8%, commodity 20%).

## Adding a provider

Implement the `Provider` interface in `app/src/lib/marketData/providers/types.ts`, add its symbol
map to `symbols.ts`, and insert it into the chain in `router.ts`. Always go through `cachedFetch`
from `lib/marketData/cache.ts` — that is what supplies the caching, single-flight, rate limiting
and circuit breaking. Declare `state` and `delayMinutes` honestly; they drive the header badge.
