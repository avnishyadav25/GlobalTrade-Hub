import 'server-only';
import { cachedFetchWithMeta } from '../cache';
import { FINNHUB_SYMBOLS } from './symbols';
import type { Provider, ProviderQuote } from './types';

// Finnhub free tier. Verified live: US equities return real-time quotes; forex
// (OANDA:*) and Indian tickers return 403, so this provider deliberately claims
// only the US symbols rather than failing per-request.
const LIMIT = { perMinute: 50 };

export const finnhub: Provider = {
    id: 'finnhub',
    state: 'live',
    delayMinutes: 0,
    supports: (symbol) => Boolean(process.env.FINNHUB_API_KEY && FINNHUB_SYMBOLS[symbol]),

    async quotes(symbols) {
        const key = process.env.FINNHUB_API_KEY;
        if (!key) return null;
        const out = await Promise.all(
            symbols
                .filter((s) => FINNHUB_SYMBOLS[s])
                .map((appSymbol) =>
                    cachedFetchWithMeta<ProviderQuote>(
                        { provider: 'finnhub', key: `q:${appSymbol}`, ttlMs: 15_000, limit: LIMIT },
                        async () => {
                            const res = await fetch(
                                `https://finnhub.io/api/v1/quote?symbol=${FINNHUB_SYMBOLS[appSymbol]}&token=${key}`,
                                { cache: 'no-store' }
                            );
                            if (!res.ok) return null;
                            const d = await res.json();
                            if (!Number.isFinite(d?.c) || d.c === 0) return null;
                            return {
                                symbol: appSymbol,
                                price: d.c,
                                prevClose: d.pc,
                                high: d.h,
                                low: d.l,
                                currency: 'USD',
                            };
                        }
                    ).then((m): ProviderQuote | null => (m ? { ...m.value, at: m.at } : null))
                )
        );
        const hits = out.filter((q): q is ProviderQuote => q !== null);
        return hits.length ? hits : null;
    },
};
