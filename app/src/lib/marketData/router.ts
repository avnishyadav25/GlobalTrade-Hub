import 'server-only';
import type { Candle } from '@/lib/mockData';
import type { Market } from '@/lib/constants';
import { yahoo } from './providers/yahoo';
import { finnhub } from './providers/finnhub';
import { binanceRest } from './providers/binanceRest';
import type { FeedState, Provider, ProviderQuote } from './providers/types';
import type { ResolvedInstrument } from './universe';

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
    /** Resolved but not fetched this cycle, because of the per-request cap. */
    deferred: string[];
}

/**
 * Hard ceiling on symbols fetched in one request, independent of whatever the client
 * asked for. `cachedFetch` already makes over-budget *safe* (it serves stale rather
 * than calling upstream once the token bucket is empty), but a large request would
 * still waste the whole Yahoo minute on low-priority symbols.
 */
export const MAX_FETCH_PER_REQUEST = 40;

export interface FetchOpts {
    maxSymbols?: number;
    /** Test seam — override the provider chain without touching module state. */
    chain?: Record<Market, Provider[]>;
}

/**
 * Takes instruments already resolved by `universe.ts`, in priority order.
 *
 * It used to take bare symbols and call `getAsset()` itself, which silently dropped
 * every user-added instrument: the registry is client-only, so on the server that
 * lookup always failed for anything outside the 16 seeds.
 */
export async function fetchQuotes(universe: ResolvedInstrument[], opts: FetchOpts = {}): Promise<QuoteBatch> {
    const chain = opts.chain ?? CHAIN;
    const cap = opts.maxSymbols ?? MAX_FETCH_PER_REQUEST;

    const fetchable = universe.slice(0, cap);
    const deferred = universe.slice(cap).map((i) => i.symbol);

    const byMarket = new Map<Market, string[]>();
    for (const i of fetchable) {
        byMarket.set(i.market, [...(byMarket.get(i.market) ?? []), i.symbol]);
    }

    const quotes: ProviderQuote[] = [];
    const status: QuoteBatch['status'] = {};

    await Promise.all(
        [...byMarket.entries()].map(async ([market, syms]) => {
            for (const p of chain[market] ?? []) {
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

    return { quotes, status, deferred };
}

export interface CandleResult {
    candles: Candle[];
    provider: string;
    state: FeedState;
    delayMinutes: number;
}

export async function fetchCandles(
    instrument: Pick<ResolvedInstrument, 'symbol' | 'market'>,
    interval: string,
    limit: number,
    opts: Pick<FetchOpts, 'chain'> = {}
): Promise<CandleResult | null> {
    const { symbol, market } = instrument;
    for (const p of (opts.chain ?? CHAIN)[market] ?? []) {
        if (!p.candles || !p.supports(symbol, market)) continue;
        const candles = await p.candles(symbol, interval, limit);
        if (candles?.length) {
            return { candles, provider: p.id, state: p.state, delayMinutes: p.delayMinutes };
        }
    }
    return null;
}
