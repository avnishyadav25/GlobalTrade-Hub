import { describe, it, expect, vi } from 'vitest';
import { fetchQuotes, fetchCandles } from './router';
import type { ResolvedInstrument } from './universe';
import type { Provider, ProviderQuote } from './providers/types';
import type { Market } from '@/lib/constants';

const inst = (symbol: string, market: Market, seeded = true): ResolvedInstrument => ({
    symbol,
    market,
    quoteCcy: market === 'india' ? 'INR' : 'USD',
    seeded,
});

/** A provider that serves exactly the symbols it is told to. */
function fake(
    id: string,
    serves: string[] | 'all',
    opts: Partial<Pick<Provider, 'state' | 'delayMinutes'>> = {}
): Provider & { seen: string[][] } {
    const seen: string[][] = [];
    return {
        id,
        seen,
        state: opts.state ?? 'live',
        delayMinutes: opts.delayMinutes ?? 0,
        supports: () => true,
        async quotes(symbols: string[]): Promise<ProviderQuote[] | null> {
            seen.push([...symbols]);
            const usable = serves === 'all' ? symbols : symbols.filter((s) => serves.includes(s));
            return usable.length ? usable.map((s) => ({ symbol: s, price: 1 })) : null;
        },
    };
}

/** Chains must cover every market; unspecified ones get nothing. */
function chainOf(partial: Partial<Record<Market, Provider[]>>): Record<Market, Provider[]> {
    return { crypto: [], us: [], india: [], forex: [], commodity: [], ...partial };
}

describe('fetchQuotes', () => {
    it('routes a user-added India instrument to the India chain', async () => {
        // The actual bug: fetchQuotes used to call getAsset() itself, and the registry
        // is client-only, so a seeded:false symbol was silently dropped on the server.
        const y = fake('yahoo', 'all');
        const batch = await fetchQuotes([inst('TCS.NS', 'india', false)], { chain: chainOf({ india: [y] }) });

        expect(y.seen).toEqual([['TCS.NS']]);
        expect(batch.quotes.map((q) => q.symbol)).toEqual(['TCS.NS']);
        expect(batch.status.india).toMatchObject({ provider: 'yahoo' });
    });

    it('groups by market and only asks providers for their own market', async () => {
        const crypto = fake('binance', 'all');
        const india = fake('yahoo', 'all');
        await fetchQuotes(
            [inst('BTC/USDT', 'crypto'), inst('RELIANCE', 'india'), inst('ETH/USDT', 'crypto')],
            { chain: chainOf({ crypto: [crypto], india: [india] }) }
        );

        expect(crypto.seen).toEqual([['BTC/USDT', 'ETH/USDT']]);
        expect(india.seen).toEqual([['RELIANCE']]);
    });

    it('asks the next provider only for the symbols the first could not serve', async () => {
        const primary = fake('finnhub', ['AAPL']);
        const fallback = fake('yahoo', 'all');
        const batch = await fetchQuotes([inst('AAPL', 'us'), inst('TSLA', 'us'), inst('NVDA', 'us')], {
            chain: chainOf({ us: [primary, fallback] }),
        });

        expect(primary.seen).toEqual([['AAPL', 'TSLA', 'NVDA']]);
        expect(fallback.seen).toEqual([['TSLA', 'NVDA']]);
        expect(batch.quotes.map((q) => q.symbol).sort()).toEqual(['AAPL', 'NVDA', 'TSLA']);
    });

    it('reports a simulated feed when no provider yields anything', async () => {
        const dead = fake('yahoo', []);
        const batch = await fetchQuotes([inst('RELIANCE', 'india')], { chain: chainOf({ india: [dead] }) });

        expect(batch.quotes).toEqual([]);
        expect(batch.status.india).toEqual({ provider: 'simulated', state: 'sim', delayMinutes: 0 });
    });

    it('stamps per-market provenance from the provider that actually answered', async () => {
        const batch = await fetchQuotes([inst('RELIANCE', 'india')], {
            chain: chainOf({ india: [fake('yahoo', 'all', { state: 'delayed', delayMinutes: 15 })] }),
        });
        expect(batch.status.india).toEqual({ provider: 'yahoo', state: 'delayed', delayMinutes: 15 });
    });

    it('clamps to maxSymbols, defers the tail, and preserves priority order', async () => {
        const p = fake('yahoo', 'all');
        const universe = Array.from({ length: 10 }, (_, i) => inst(`S${i}`, 'india'));
        const batch = await fetchQuotes(universe, { chain: chainOf({ india: [p] }), maxSymbols: 4 });

        expect(p.seen).toEqual([['S0', 'S1', 'S2', 'S3']]);
        expect(batch.deferred).toEqual(['S4', 'S5', 'S6', 'S7', 'S8', 'S9']);
    });

    it('returns an empty batch for an empty universe without calling anything', async () => {
        const p = fake('yahoo', 'all');
        const batch = await fetchQuotes([], { chain: chainOf({ india: [p] }) });

        expect(batch).toEqual({ quotes: [], status: {}, deferred: [] });
        expect(p.seen).toEqual([]);
    });
});

describe('fetchCandles', () => {
    const withCandles = (id: string, data: { time: number; open: number; high: number; low: number; close: number }[] | null) => ({
        id,
        state: 'live' as const,
        delayMinutes: 0,
        supports: () => true,
        candles: vi.fn(async () => data),
    });

    it('uses the market from the resolved instrument rather than a registry lookup', async () => {
        const y = withCandles('yahoo', [{ time: 1, open: 1, high: 2, low: 0.5, close: 1.5 }]);
        const got = await fetchCandles({ symbol: 'TCS.NS', market: 'india' }, '15m', 100, {
            chain: chainOf({ india: [y] }),
        });

        expect(y.candles).toHaveBeenCalledWith('TCS.NS', '15m', 100);
        expect(got).toMatchObject({ provider: 'yahoo', delayMinutes: 0 });
        expect(got!.candles).toHaveLength(1);
    });

    it('falls through to the next provider when the first returns nothing', async () => {
        const empty = withCandles('finnhub', null);
        const good = withCandles('yahoo', [{ time: 1, open: 1, high: 2, low: 0.5, close: 1.5 }]);
        const got = await fetchCandles({ symbol: 'AAPL', market: 'us' }, '1d', 50, {
            chain: chainOf({ us: [empty, good] }),
        });

        expect(empty.candles).toHaveBeenCalled();
        expect(got!.provider).toBe('yahoo');
    });

    it('returns null when no provider in the chain can serve it', async () => {
        expect(await fetchCandles({ symbol: 'AAPL', market: 'us' }, '1d', 50, { chain: chainOf({}) })).toBeNull();
    });
});
