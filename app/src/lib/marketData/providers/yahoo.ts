import 'server-only';
import { cachedFetch, cachedFetchWithMeta } from '../cache';
import { YAHOO_SYMBOLS } from './symbols';
import type { Provider, ProviderQuote } from './types';
import type { Candle } from '@/lib/mockData';

// Yahoo Finance v8 chart endpoint.
//
// Free, no key, and — verified live — it covers the ENTIRE instrument universe:
// India (.NS), US, FX (=X), commodity futures (=F) and crypto (-USD). That makes it
// the universal fallback.
//
// Caveats, both surfaced to the user rather than hidden:
//   * unofficial — Yahoo can rate-limit or block by IP, hence the token bucket
//   * quotes are delayed ~15 min for equities
const LIMIT = { perMinute: 30 };
const RANGE_FOR: Record<string, string> = {
    '1m': '1d', '5m': '5d', '15m': '1mo', '1h': '3mo', '4h': '6mo', '1d': '2y',
};

interface YahooMeta {
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    regularMarketVolume?: number;
    currency?: string;
}

async function chart(sym: string, interval: string, range: string) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range}`;
    const res = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; GlobalTradeHub/1.0)' },
        cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.chart?.result?.[0] ?? null;
}

/** Seeded instruments have an explicit mapping; user-added ones use their own
 *  Yahoo ticker as the app symbol, so they pass through unchanged. */
function toYahoo(appSymbol: string): string | null {
    return YAHOO_SYMBOLS[appSymbol] ?? (/^[A-Z0-9.^=-]{1,20}$/i.test(appSymbol) ? appSymbol : null);
}

export async function yahooQuote(appSymbol: string): Promise<ProviderQuote | null> {
    const sym = toYahoo(appSymbol);
    if (!sym) return null;
    // 90s, not 60s: the client polls every 60s, so a 60s TTL means essentially every
    // poll misses, and two tabs offset by 30s double-spend the bucket. Yahoo equity
    // quotes are ~15 min delayed anyway, so 90s costs no real freshness.
    const meta = await cachedFetchWithMeta<ProviderQuote>(
        { provider: 'yahoo', key: `q:${sym}`, ttlMs: 90_000, limit: LIMIT },
        async () => {
            const r = await chart(sym, '1d', '5d');
            const m: YahooMeta | undefined = r?.meta;
            if (!m?.regularMarketPrice) return null;
            return {
                symbol: appSymbol,
                price: m.regularMarketPrice,
                // Yahoo exposes chartPreviousClose here, not previousClose.
                prevClose: m.chartPreviousClose ?? m.previousClose,
                high: m.regularMarketDayHigh,
                low: m.regularMarketDayLow,
                volume: m.regularMarketVolume,
                currency: m.currency,
            };
        }
    );
    return meta ? { ...meta.value, at: meta.at } : null;
}

export const yahoo: Provider = {
    id: 'yahoo',
    state: 'delayed',
    delayMinutes: 15,
    supports: (symbol) => Boolean(toYahoo(symbol)),

    async quotes(symbols) {
        const out = await Promise.all(symbols.map((s) => yahooQuote(s)));
        const hits = out.filter((q): q is ProviderQuote => q !== null);
        return hits.length ? hits : null;
    },

    async candles(appSymbol, interval, limit) {
        const sym = toYahoo(appSymbol);
        if (!sym) return null;
        const range = RANGE_FOR[interval] ?? '1mo';
        return cachedFetch<Candle[]>(
            { provider: 'yahoo', key: `c:${sym}:${interval}:${range}`, ttlMs: 5 * 60_000, limit: LIMIT },
            async () => {
                const r = await chart(sym, interval, range);
                const ts: number[] = r?.timestamp ?? [];
                const q = r?.indicators?.quote?.[0];
                if (!ts.length || !q) return null;
                const rows: Candle[] = [];
                for (let i = 0; i < ts.length; i++) {
                    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
                    // Yahoo pads gaps with nulls; drop them rather than emit NaN bars.
                    if ([o, h, l, c].some((v) => v == null || !Number.isFinite(v))) continue;
                    rows.push({ time: ts[i], open: o, high: h, low: l, close: c, volume: q.volume?.[i] ?? undefined });
                }
                return rows.length ? rows.slice(-limit) : null;
            }
        );
    },
};
