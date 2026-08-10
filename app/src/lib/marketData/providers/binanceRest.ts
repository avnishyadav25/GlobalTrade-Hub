import 'server-only';
import { cachedFetch } from '../cache';
import { BINANCE_SYMBOLS } from './symbols';
import type { Provider, ProviderQuote } from './types';
import type { Candle } from '@/lib/mockData';

// Binance public REST. Free, keyless, real-time, effectively unlimited for our
// volume. The live WebSocket feed in ../binance.ts handles streaming; this covers
// server-side quotes and historical klines.
const LIMIT = { perMinute: 120 };

export const binanceRest: Provider = {
    id: 'binance',
    state: 'live',
    delayMinutes: 0,
    supports: (symbol) => Boolean(BINANCE_SYMBOLS[symbol]),

    async quotes(symbols) {
        const out = await Promise.all(
            symbols
                .filter((s) => BINANCE_SYMBOLS[s])
                .map((appSymbol) =>
                    cachedFetch<ProviderQuote>(
                        { provider: 'binance', key: `q:${appSymbol}`, ttlMs: 10_000, limit: LIMIT },
                        async () => {
                            const res = await fetch(
                                `https://api.binance.com/api/v3/ticker/24hr?symbol=${BINANCE_SYMBOLS[appSymbol]}`,
                                { cache: 'no-store' }
                            );
                            if (!res.ok) return null;
                            const d = await res.json();
                            const price = parseFloat(d.lastPrice);
                            if (!Number.isFinite(price)) return null;
                            return {
                                symbol: appSymbol,
                                price,
                                prevClose: parseFloat(d.openPrice),
                                high: parseFloat(d.highPrice),
                                low: parseFloat(d.lowPrice),
                                volume: parseFloat(d.quoteVolume),
                                currency: 'USD',
                            };
                        }
                    )
                )
        );
        const hits = out.filter((q): q is ProviderQuote => q !== null);
        return hits.length ? hits : null;
    },

    async candles(appSymbol, interval, limit) {
        const pair = BINANCE_SYMBOLS[appSymbol];
        if (!pair) return null;
        return cachedFetch<Candle[]>(
            { provider: 'binance', key: `c:${pair}:${interval}:${limit}`, ttlMs: 60_000, limit: LIMIT },
            async () => {
                const res = await fetch(
                    `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${Math.min(1000, limit)}`,
                    { cache: 'no-store' }
                );
                if (!res.ok) return null;
                const rows = (await res.json()) as unknown[][];
                return rows.map((r) => ({
                    time: Math.floor(Number(r[0]) / 1000),
                    open: Number(r[1]),
                    high: Number(r[2]),
                    low: Number(r[3]),
                    close: Number(r[4]),
                    volume: Number(r[5]),
                }));
            }
        );
    },
};
