// Instrument registry.
//
// The tradeable universe used to be the hardcoded `WATCHLIST_ASSETS` array, and
// `paperEngine.validate()` rejects any symbol `getAsset()` cannot resolve — so a
// user-added instrument would have been untradeable. Worse, `marketOf()` defaults to
// 'crypto' and `quoteCcyOf()` to 'USD', which would have silently mispriced an NSE
// stock in a ₹ book.
//
// This is deliberately module-global mutable state. The paper engine is pure and
// synchronous; threading a resolver through every function would touch all 64 tests
// for no behavioural gain. Registration happens on store rehydrate, on add, and on
// cloud hydrate — see stores/watchlistStore.ts.

import { isValidOptionContract } from './options/contract';
import { WATCHLIST_ASSETS, REFERENCE_ASSETS, type Asset, type Currency } from './mockData';
import { MARKETS, type Market } from './constants';

// Lazily seeded. mockData imports this module for getAsset(), so reading
// WATCHLIST_ASSETS at module scope hits a circular-import TDZ where it is still
// undefined. Seeding on first access sidesteps that entirely.
const registry = new Map<string, Asset>();
const seeded = new Set<string>();
let ready = false;

function ensureSeeded() {
    if (ready) return;
    ready = true;
    // Both catalogues seed the registry so reference series resolve and can be fetched;
    // only WATCHLIST_ASSETS builds the default watchlist.
    for (const a of [...WATCHLIST_ASSETS, ...REFERENCE_ASSETS]) {
        registry.set(a.symbol, a);
        seeded.add(a.symbol);
    }
}

const VALID_MARKETS = new Set<string>(Object.values(MARKETS));
const VALID_CCY = new Set<string>(['INR', 'USD', 'JPY']);

export function lookup(symbol: string): Asset | undefined {
    ensureSeeded();
    return registry.get(symbol);
}

export function allInstruments(): Asset[] {
    ensureSeeded();
    return [...registry.values()];
}

export function isSeeded(symbol: string): boolean {
    ensureSeeded();
    return seeded.has(symbol);
}

/** Validates shape before admitting an instrument — a bad market or currency here
 *  would mis-price every position in that symbol. */
export function isValidAsset(a: unknown): a is Asset {
    if (!a || typeof a !== 'object') return false;
    const x = a as Partial<Asset>;
    return (
        typeof x.symbol === 'string' && x.symbol.length > 0 &&
        typeof x.name === 'string' &&
        typeof x.market === 'string' && VALID_MARKETS.has(x.market) &&
        typeof x.quoteCcy === 'string' && VALID_CCY.has(x.quoteCcy) &&
        typeof x.fractional === 'boolean' &&
        // Absent is fine — spot instruments have no contract. Malformed is not: a
        // cloud-synced watchlist row could otherwise inject a bogus lotSize and mis-size
        // every order in that contract by a whole multiple.
        (x.contract === undefined || isValidOptionContract(x.contract)) &&
        typeof x.price === 'number' && Number.isFinite(x.price)
    );
}

/** Append-only. Never overwrites a seed entry. Returns how many were admitted. */
export function registerInstruments(assets: unknown[]): number {
    ensureSeeded();
    let added = 0;
    for (const a of assets) {
        if (!isValidAsset(a)) continue;
        if (seeded.has(a.symbol)) continue;
        registry.set(a.symbol, a);
        added++;
    }
    return added;
}

export function unregisterInstrument(symbol: string): void {
    ensureSeeded();
    if (seeded.has(symbol)) return;
    registry.delete(symbol);
}

/** Build an Asset from a provider search hit. */
export function makeAsset(input: {
    symbol: string; name: string; market: Market; exchange: string;
    quoteCcy: Currency; price?: number;
}): Asset {
    return {
        symbol: input.symbol,
        name: input.name,
        market: input.market,
        exchange: input.exchange,
        quoteCcy: input.quoteCcy,
        // Equities and indices trade in whole units; crypto/FX/commodity are fractional.
        fractional: input.market === 'crypto' || input.market === 'forex' || input.market === 'commodity',
        price: input.price ?? 0,
        change: 0,
        changePercent: 0,
        volume: 0,
        high24h: input.price ?? 0,
        low24h: input.price ?? 0,
    };
}
