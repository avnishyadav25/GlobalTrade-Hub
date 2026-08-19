import { describe, it, expect } from 'vitest';
import {
    resolveUniverse,
    resolveOne,
    universeFromWatchlistState,
    SYMBOL_RE,
    MAX_UNIVERSE,
    MAX_REQUESTED,
    type InstrumentHint,
} from './universe';
import { WATCHLIST_ASSETS } from '@/lib/mockData';
import { lookup, allInstruments } from '@/lib/instruments';

const hint = (symbol: string, market: string, quoteCcy: string, price?: number): InstrumentHint => ({
    symbol,
    market,
    quoteCcy,
    price,
});

describe('resolveUniverse — seeds', () => {
    it('resolves every seeded instrument with its exact market and currency', () => {
        const { universe, dropped } = resolveUniverse(WATCHLIST_ASSETS.map((a) => a.symbol));

        expect(universe).toHaveLength(WATCHLIST_ASSETS.length);
        expect(dropped).toEqual({});

        for (const asset of WATCHLIST_ASSETS) {
            const got = universe.find((i) => i.symbol === asset.symbol);
            expect(got, `${asset.symbol} should resolve`).toBeDefined();
            expect(got!.market).toBe(asset.market);
            expect(got!.quoteCcy).toBe(asset.quoteCcy);
            expect(got!.seeded).toBe(true);
        }
    });

    it('keeps USD/JPY quoted in JPY, not USD', () => {
        // The currency model note in mockData: quoteCcy is NOT implied by market.
        // Getting this wrong valued USD/JPY ~159x too high.
        const { universe } = resolveUniverse(['USD/JPY']);
        expect(universe[0].quoteCcy).toBe('JPY');
        expect(universe[0].market).toBe('forex');
    });

    it('accepts seeds containing spaces and slashes', () => {
        const { universe, dropped } = resolveUniverse(['NIFTY 50', 'BTC/USDT', 'XAU/USD']);
        expect(universe.map((i) => i.symbol)).toEqual(['NIFTY 50', 'BTC/USDT', 'XAU/USD']);
        expect(dropped).toEqual({});
    });

    it('a hint can never override a seed', () => {
        const { universe } = resolveUniverse(['RELIANCE'], [hint('RELIANCE', 'crypto', 'USD', 999)]);
        expect(universe[0]).toMatchObject({ market: 'india', quoteCcy: 'INR', seeded: true });
        expect(universe[0].price).toBe(WATCHLIST_ASSETS.find((a) => a.symbol === 'RELIANCE')!.price);
    });
});

describe('resolveUniverse — user-added instruments', () => {
    it('resolves an unknown symbol when a valid hint is supplied', () => {
        const { universe, dropped } = resolveUniverse(['TCS.NS'], [hint('TCS.NS', 'india', 'INR', 3120)]);
        expect(dropped).toEqual({});
        expect(universe[0]).toEqual({
            symbol: 'TCS.NS',
            market: 'india',
            quoteCcy: 'INR',
            seeded: false,
            price: 3120,
        });
    });

    it('DROPS an unknown symbol with no hint rather than defaulting it', () => {
        // Defaulting to crypto/USD is the mispricing instruments.ts warns about:
        // it would value an NSE stock in dollars inside a rupee book.
        const { universe, dropped } = resolveUniverse(['TCS.NS']);
        expect(universe).toEqual([]);
        expect(dropped['TCS.NS']).toBe('unknown');
    });

    it.each([['equities'], ['CRYPTO'], [''], ['stocks']])('rejects hint market %j', (market) => {
        const { universe, dropped } = resolveUniverse(['TCS.NS'], [hint('TCS.NS', market, 'INR')]);
        expect(universe).toEqual([]);
        expect(dropped['TCS.NS']).toBe('bad-market');
    });

    it.each([['EUR'], ['inr'], ['GBP'], ['']])('rejects hint currency %j', (ccy) => {
        const { universe, dropped } = resolveUniverse(['TCS.NS'], [hint('TCS.NS', 'india', ccy)]);
        expect(universe).toEqual([]);
        expect(dropped['TCS.NS']).toBe('bad-currency');
    });

    it('ignores a non-positive or non-finite hint price', () => {
        const zero = resolveUniverse(['TCS.NS'], [hint('TCS.NS', 'india', 'INR', 0)]);
        expect(zero.universe[0].price).toBeUndefined();

        const nan = resolveUniverse(['TCS.NS'], [hint('TCS.NS', 'india', 'INR', Number.NaN)]);
        expect(nan.universe[0].price).toBeUndefined();
    });

    it('survives malformed hint entries without dropping the whole request', () => {
        const { universe } = resolveUniverse(
            ['TCS.NS', 'AAPL'],
            [null, 'garbage', { symbol: 42 }, hint('TCS.NS', 'india', 'INR')]
        );
        expect(universe.map((i) => i.symbol)).toEqual(['TCS.NS', 'AAPL']);
    });
});

describe('resolveUniverse — symbol validation', () => {
    it.each([['NIFTY 50'], ['BTC/USDT'], ['TCS.NS'], ['^NSEI'], ['GC=F'], ['BTC-USD'], ['AAPL']])(
        'accepts %j',
        (symbol) => {
            expect(SYMBOL_RE.test(symbol)).toBe(true);
        }
    );

    it.each([
        ['../../etc/passwd'],
        ['<script>alert(1)</script>'],
        ['BTC;DROP TABLE'],
        ['   '],
        ['?q=1'],
        ['A'.repeat(64)],
        ['.LEADINGDOT'],
    ])('rejects %j', (symbol) => {
        const { universe, dropped } = resolveUniverse([symbol]);
        expect(universe).toEqual([]);
        // whitespace-only trims to empty and is unkeyable, so it is skipped silently
        if (symbol.trim()) expect(dropped[symbol.trim()]).toBe('bad-symbol');
    });

    it('trims surrounding whitespace before resolving', () => {
        const { universe } = resolveUniverse(['  AAPL  ']);
        expect(universe[0].symbol).toBe('AAPL');
    });

    it('ignores non-string entries', () => {
        const { universe } = resolveUniverse([null, 7, {}, 'AAPL']);
        expect(universe.map((i) => i.symbol)).toEqual(['AAPL']);
    });
});

describe('resolveUniverse — ordering and caps', () => {
    it('preserves request order', () => {
        const order = ['NVDA', 'BTC/USDT', 'RELIANCE', 'EUR/USD'];
        expect(resolveUniverse(order).universe.map((i) => i.symbol)).toEqual(order);
    });

    it('dedupes silently, keeping the first occurrence', () => {
        const { universe, dropped } = resolveUniverse(['AAPL', 'TSLA', 'AAPL']);
        expect(universe.map((i) => i.symbol)).toEqual(['AAPL', 'TSLA']);
        expect(dropped).toEqual({});
    });

    it('caps the universe and reports the overflow, preserving priority order', () => {
        const many = Array.from({ length: MAX_UNIVERSE + 30 }, (_, i) => `SYM${i}`);
        const hints = many.map((s) => hint(s, 'us', 'USD'));
        const { universe, dropped } = resolveUniverse(many, hints);

        expect(universe).toHaveLength(MAX_UNIVERSE);
        expect(universe[0].symbol).toBe('SYM0');
        expect(universe.at(-1)!.symbol).toBe(`SYM${MAX_UNIVERSE - 1}`);
        expect(dropped[`SYM${MAX_UNIVERSE}`]).toBe('over-cap');
        expect(Object.keys(dropped)).toHaveLength(30);
    });

    it('ignores symbols beyond MAX_REQUESTED before doing per-symbol work', () => {
        const many = Array.from({ length: MAX_REQUESTED + 50 }, (_, i) => `SYM${i}`);
        const { universe, dropped } = resolveUniverse(many);
        expect(universe).toEqual([]);
        expect(Object.keys(dropped)).toHaveLength(MAX_REQUESTED);
    });

    it('returns an empty result for a non-array input rather than throwing', () => {
        expect(resolveUniverse(undefined)).toEqual({ universe: [], dropped: {} });
        expect(resolveUniverse('AAPL')).toEqual({ universe: [], dropped: {} });
    });
});

describe('no global registry mutation', () => {
    it('leaves the shared instrument registry untouched', () => {
        // The hard rule: the registry is process-global and shared across requests.
        // Resolving one request's instruments must never leak into another's.
        const before = allInstruments().length;

        resolveUniverse(
            ['TCS.NS', 'INFY.NS', 'MSFT'],
            [hint('TCS.NS', 'india', 'INR'), hint('INFY.NS', 'india', 'INR'), hint('MSFT', 'us', 'USD')]
        );
        resolveOne('DOGE-USD', hint('DOGE-USD', 'crypto', 'USD'));

        expect(lookup('TCS.NS')).toBeUndefined();
        expect(lookup('MSFT')).toBeUndefined();
        expect(lookup('DOGE-USD')).toBeUndefined();
        expect(allInstruments()).toHaveLength(before);
    });
});

describe('resolveOne', () => {
    it('resolves a seed without a hint', () => {
        expect(resolveOne('AAPL')).toMatchObject({ market: 'us', quoteCcy: 'USD', seeded: true });
    });

    it('resolves a hinted unknown', () => {
        expect(resolveOne('TCS.NS', hint('TCS.NS', 'india', 'INR'))).toMatchObject({
            market: 'india',
            seeded: false,
        });
    });

    it('returns null for an unhinted unknown, a bad hint, or a bad symbol', () => {
        expect(resolveOne('TCS.NS')).toBeNull();
        expect(resolveOne('TCS.NS', hint('TCS.NS', 'equities', 'INR'))).toBeNull();
        expect(resolveOne('../etc/passwd')).toBeNull();
        expect(resolveOne('')).toBeNull();
    });
});

describe('universeFromWatchlistState', () => {
    // The exact shape cloudSync persists for the `watchlists` entry.
    const persisted = {
        lists: [
            { id: 'wl-default', name: 'Default', symbols: ['AAPL', 'RELIANCE'] },
            { id: 'wl-2', name: 'India', symbols: ['TCS.NS', 'AAPL'] },
        ],
        activeListId: 'wl-default',
        customInstruments: [
            { symbol: 'TCS.NS', name: 'TCS', market: 'india', exchange: 'NSE', quoteCcy: 'INR', fractional: false, price: 3120 },
        ],
    };

    it('flattens every list, deduped, and maps custom instruments to hints', () => {
        const { symbols, hints } = universeFromWatchlistState(persisted);
        expect(symbols).toEqual(['AAPL', 'RELIANCE', 'TCS.NS']);
        expect(hints).toEqual([{ symbol: 'TCS.NS', market: 'india', quoteCcy: 'INR', price: 3120 }]);
    });

    it('round-trips through resolveUniverse', () => {
        const { symbols, hints } = universeFromWatchlistState(persisted);
        const { universe, dropped } = resolveUniverse(symbols, hints);
        expect(dropped).toEqual({});
        expect(universe.map((i) => i.symbol)).toEqual(['AAPL', 'RELIANCE', 'TCS.NS']);
        expect(universe.find((i) => i.symbol === 'TCS.NS')!.market).toBe('india');
    });

    it.each([
        [null],
        [undefined],
        ['not an object'],
        [{}],
        [{ lists: 'nope' }],
        [{ lists: [] }],
        [{ lists: [null, { symbols: null }, { symbols: [1, 2] }] }],
    ])('returns empty inputs for malformed state %j', (value) => {
        expect(universeFromWatchlistState(value)).toEqual({ symbols: [], hints: [] });
    });

    it('skips custom instruments missing market or currency', () => {
        const { hints } = universeFromWatchlistState({
            lists: [],
            customInstruments: [{ symbol: 'X' }, { symbol: 'Y', market: 'us' }, { symbol: 'Z', market: 'us', quoteCcy: 'USD' }],
        });
        expect(hints.map((h) => h.symbol)).toEqual(['Z']);
    });
});
