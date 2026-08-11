import 'server-only';

import { WATCHLIST_ASSETS, REFERENCE_ASSETS, type Asset, type Currency } from '@/lib/mockData';
import { MARKETS, type Market } from '@/lib/constants';

// Per-request instrument resolution for the server.
//
// WHY THIS EXISTS
// `lib/instruments.ts` is a module-global registry, and all three of its
// `registerInstruments()` call sites are client-only (watchlistStore rehydrate/add,
// cloudSync hydrate). So on the server the registry only ever holds the 16 seeds, and
// `router.fetchQuotes` used to do `getAsset(s)?.market; if (!m) continue` — silently
// dropping every user-added instrument. That is why adding TCS.NS produced a row that
// never got a price and could not be charted.
//
// THE HARD RULE: this module never writes to the global registry. That map is
// process-global and shared across every request; registering one user's instruments
// into it would leak them into another user's resolution. Requests carry their own
// descriptors and we resolve them into a per-request value.
//
// The seed table below is built from WATCHLIST_ASSETS directly rather than through
// `getAsset()`/`lookup()`. That is deliberate: routing through the mutable registry
// would make the no-server-global property incidental rather than structural.

/** A client-supplied descriptor for a NON-seeded instrument. Wire-shaped, untrusted. */
export interface InstrumentHint {
    symbol: string;
    market: string;
    quoteCcy: string;
    /** Optional. Used only as the base for the synthetic candle fallback. */
    price?: number;
}

/** Validated. Never stored in any module-global. */
export interface ResolvedInstrument {
    symbol: string;
    market: Market;
    quoteCcy: Currency;
    /** True when it came from WATCHLIST_ASSETS. A hint can never set this. */
    seeded: boolean;
    price?: number;
}

export type DropReason = 'bad-symbol' | 'unknown' | 'bad-market' | 'bad-currency' | 'over-cap';

export interface ResolveResult {
    /** Request order is preserved — that is what makes client-side prioritisation work. */
    universe: ResolvedInstrument[];
    dropped: Record<string, DropReason>;
}

/** Most instruments we will resolve for one request. */
export const MAX_UNIVERSE = 120;
/** Symbols accepted before per-symbol work begins. Above this the request is rejected. */
export const MAX_REQUESTED = 500;
/** Descriptors accepted per request. */
export const MAX_HINTS = 200;

/**
 * Must accept every seed — 'NIFTY 50' has a space, 'BTC/USDT' and 'XAU/USD' have
 * slashes — as well as Yahoo tickers: 'TCS.NS', '^NSEI', 'GC=F', 'BTC-USD'.
 * Symbols are not case-folded: registry keys are exact-match.
 *
 * `^` is allowed as a leading character because that is Yahoo's index prefix
 * (^NSEI, ^BSESN, ^GSPC). `.` and `-` are not, so path traversal cannot start one.
 */
export const SYMBOL_RE = /^[A-Za-z0-9^][A-Za-z0-9.^=/\- ]{0,23}$/;

const VALID_MARKETS = new Set<string>(Object.values(MARKETS));
const VALID_CCY = new Set<string>(['INR', 'USD', 'JPY']);

// Lazily built for the same reason instruments.ts seeds lazily: mockData imports
// instruments, so reading WATCHLIST_ASSETS at module scope can hit a circular-import
// TDZ where it is still undefined.
let seeds: Map<string, ResolvedInstrument> | null = null;

function seedTable(): Map<string, ResolvedInstrument> {
    if (seeds) return seeds;
    const m = new Map<string, ResolvedInstrument>();
    for (const a of [...WATCHLIST_ASSETS, ...REFERENCE_ASSETS]) {
        m.set(
            a.symbol,
            Object.freeze({
                symbol: a.symbol,
                market: a.market,
                quoteCcy: a.quoteCcy,
                seeded: true,
                price: a.price,
            })
        );
    }
    seeds = m;
    return m;
}

type Attempt = { instrument: ResolvedInstrument } | { reason: DropReason };

/** Resolve one already-trimmed, already-regex-checked symbol. */
function attempt(symbol: string, hint: InstrumentHint | undefined): Attempt {
    const seed = seedTable().get(symbol);
    // A hint can never override a seed. This mirrors registerInstruments' append-only
    // rule, and stops a request claiming RELIANCE is crypto/USD.
    if (seed) return { instrument: seed };

    if (!hint) return { reason: 'unknown' };
    if (typeof hint.market !== 'string' || !VALID_MARKETS.has(hint.market)) return { reason: 'bad-market' };
    if (typeof hint.quoteCcy !== 'string' || !VALID_CCY.has(hint.quoteCcy)) return { reason: 'bad-currency' };

    const price = typeof hint.price === 'number' && Number.isFinite(hint.price) && hint.price > 0 ? hint.price : undefined;
    return {
        instrument: {
            symbol,
            market: hint.market as Market,
            quoteCcy: hint.quoteCcy as Currency,
            seeded: false,
            price,
        },
    };
}

function normalise(raw: unknown): string {
    return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Turn a requested symbol list plus optional descriptors into a validated universe.
 *
 * Pure: no I/O, no mutation, no Date.now(). Duplicates are deduped silently, keeping
 * the first occurrence so caller priority order survives.
 *
 * A symbol with no seed entry and no hint is DROPPED, never defaulted. Defaulting to
 * crypto/USD is exactly the mispricing instruments.ts warns about — it would value an
 * NSE stock in dollars inside a ₹ book.
 */
export function resolveUniverse(symbols: unknown, hints?: unknown): ResolveResult {
    const hintBySymbol = new Map<string, InstrumentHint>();
    if (Array.isArray(hints)) {
        for (const h of hints.slice(0, MAX_HINTS)) {
            if (!h || typeof h !== 'object') continue;
            const key = normalise((h as InstrumentHint).symbol);
            if (key && !hintBySymbol.has(key)) hintBySymbol.set(key, h as InstrumentHint);
        }
    }

    const universe: ResolvedInstrument[] = [];
    const dropped: Record<string, DropReason> = {};
    const seen = new Set<string>();

    const requested = Array.isArray(symbols) ? symbols.slice(0, MAX_REQUESTED) : [];
    for (const raw of requested) {
        const s = normalise(raw);
        if (!s) continue; // unkeyable in `dropped`; nothing useful to report
        if (!SYMBOL_RE.test(s)) {
            dropped[s] = 'bad-symbol';
            continue;
        }
        if (seen.has(s)) continue;
        seen.add(s);

        if (universe.length >= MAX_UNIVERSE) {
            dropped[s] = 'over-cap';
            continue;
        }

        const a = attempt(s, hintBySymbol.get(s));
        if ('instrument' in a) universe.push(a.instrument);
        else dropped[s] = a.reason;
    }

    return { universe, dropped };
}

/** Single-symbol form, for the candles route. Null when it cannot be resolved. */
export function resolveOne(symbol: unknown, hint?: InstrumentHint): ResolvedInstrument | null {
    const s = normalise(symbol);
    if (!s || !SYMBOL_RE.test(s)) return null;
    const a = attempt(s, hint);
    return 'instrument' in a ? a.instrument : null;
}

/**
 * Extract resolver inputs from the persisted `watchlists` blob (cloudSync's snapshot,
 * stored in gth_app_state). `customInstruments` entries are complete Assets, so they
 * already carry the market and quoteCcy a hint needs — no schema change.
 *
 * Kept separate from Supabase access so it is testable without a database.
 */
export function universeFromWatchlistState(value: unknown): { symbols: string[]; hints: InstrumentHint[] } {
    const v = (value ?? {}) as { lists?: unknown; customInstruments?: unknown };

    const symbols: string[] = [];
    const seen = new Set<string>();
    if (Array.isArray(v.lists)) {
        for (const list of v.lists) {
            const syms = (list as { symbols?: unknown } | null)?.symbols;
            if (!Array.isArray(syms)) continue;
            for (const raw of syms) {
                const s = normalise(raw);
                if (s && !seen.has(s)) {
                    seen.add(s);
                    symbols.push(s);
                }
            }
        }
    }

    const hints: InstrumentHint[] = [];
    if (Array.isArray(v.customInstruments)) {
        for (const raw of v.customInstruments) {
            if (!raw || typeof raw !== 'object') continue;
            const a = raw as Partial<Asset>;
            if (typeof a.symbol !== 'string' || typeof a.market !== 'string' || typeof a.quoteCcy !== 'string') continue;
            hints.push({
                symbol: a.symbol,
                market: a.market,
                quoteCcy: a.quoteCcy,
                price: typeof a.price === 'number' ? a.price : undefined,
            });
        }
    }

    return { symbols, hints };
}
