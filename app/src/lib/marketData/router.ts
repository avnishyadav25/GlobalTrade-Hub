import 'server-only';
import { getAsset, type Candle } from '@/lib/mockData';
import type { Market } from '@/lib/constants';
import { yahoo } from './providers/yahoo';
import { finnhub } from './providers/finnhub';
import { binanceRest } from './providers/binanceRest';
import type { FeedState, Provider, ProviderQuote } from './providers/types';

/**
 * Market -> ordered provider chain, with fall-through.
 *
 * Ordering is by (real-time > delayed) then (keyless > keyed), based on what was
 * verified to actually work:
 *   crypto    binance   real-time, free, keyless
 *   us        finnhub   real-time on the free tier; yahoo is the delayed fallback
 *   india     yahoo     the only free source without a broker account
 *   forex     yahoo     =X pairs
 *   commodity yahoo     =F futures
 *
 * Twelve Data is deliberately absent: Yahoo covers everything it did, keylessly and
 * without an 800/day cap.
 */
const CHAIN: Record<Market, Provider[]> = {
    crypto: [binanceRest, yahoo],
    us: [finnhub, yahoo],
    india: [yahoo],
    forex: [yahoo],
    commodity: [yahoo],
};

export interface QuoteBatch {
    quotes: ProviderQuote[];
    /** Per-market provenance so the UI can be honest about staleness. */
    status: Partial<Record<Market, { provider: string; state: FeedState; delayMinutes: number }>>;
}

export async function fetchQuotes(symbols: string[]): Promise<QuoteBatch> {
    const byMarket = new Map<Market, string[]>();
    for (const s of symbols) {
        const m = getAsset(s)?.market;
        if (!m) continue;
        byMarket.set(m, [...(byMarket.get(m) ?? []), s]);
    }

    const quotes: ProviderQuote[] = [];
    const status: QuoteBatch['status'] = {};

    await Promise.all(
        [...byMarket.entries()].map(async ([market, syms]) => {
            for (const p of CHAIN[market] ?? []) {
                if (!p.quotes) continue;
                const usable = syms.filter((s) => p.supports(s, market));
                if (!usable.length) continue;
                const got = await p.quotes(usable);
                if (got?.length) {
                    quotes.push(...got);
                    status[market] = { provider: p.id, state: p.state, delayMinutes: p.delayMinutes };
                    // Any symbol this provider couldn't serve falls to the next one.
                    const missing = usable.filter((s) => !got.some((q) => q.symbol === s));
                    if (!missing.length) return;
                    syms = missing;
                    continue;
                }
            }
            if (!status[market]) status[market] = { provider: 'simulated', state: 'sim', delayMinutes: 0 };
        })
    );

    return { quotes, status };
}

export interface CandleResult {
    candles: Candle[];
    provider: string;
    state: FeedState;
    delayMinutes: number;
}

export async function fetchCandles(symbol: string, interval: string, limit: number): Promise<CandleResult | null> {
    const market = getAsset(symbol)?.market;
    if (!market) return null;
    for (const p of CHAIN[market] ?? []) {
        if (!p.candles || !p.supports(symbol, market)) continue;
        const candles = await p.candles(symbol, interval, limit);
        if (candles?.length) {
            return { candles, provider: p.id, state: p.state, delayMinutes: p.delayMinutes };
        }
    }
    return null;
}
