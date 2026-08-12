import type { OptionType } from './greeks';

// Option contract identity.
//
// Positions in the paper engine are keyed by SYMBOL alone, so a long call and a short
// call on the same underlying would collide unless the symbol carries the whole
// contract. And `SYMBOL_RE` in marketData/universe.ts caps a symbol at 24 characters
// over [A-Za-z0-9.^=/\- ] — no colon, no underscore.
//
// So the format is contiguous, with no separators:
//
//     <ROOT><YYMMDD><STRIKE><CE|PE>
//     NIFTY26012924500CE          18 chars
//     BANKNIFTY260129100000CE     23 chars  ← worst case, still inside the limit
//
// Separators do not fit: `BANKNIFTY-260129-52000-CE` is 25. Contiguous is the only form
// that clears 24 for BANKNIFTY, and it happens to match what NSE prints.
//
// Parsing is unambiguous because the root set is closed and neither root is a prefix of
// the other: match the longest root, take six digits of date, two letters of type, and
// everything between is the strike.

export type { OptionType };

export const OPTION_ROOTS = ['BANKNIFTY', 'NIFTY'] as const; // longest first — order matters for parsing
export type OptionRoot = (typeof OPTION_ROOTS)[number];

/** Registry symbol of the index each root settles against. */
export const UNDERLYING_OF: Record<OptionRoot, string> = {
    NIFTY: 'NIFTY 50',
    BANKNIFTY: 'NIFTY BANK',
};

export interface OptionContract {
    root: OptionRoot;
    /** Registry symbol of the underlying index. Must resolve through getAsset(). */
    underlying: string;
    /** Expiry date as YYYY-MM-DD in IST. The human-readable key. */
    expiry: string;
    /**
     * Settlement instant, epoch ms — 15:30 IST on the expiry date.
     *
     * Computed ONCE when the contract is registered, so the paper engine never has to do
     * timezone arithmetic and stays pure and clock-free.
     */
    expiryMs: number;
    strike: number;
    optionType: OptionType;
    /**
     * Quantity STEP, in units — not a notional multiplier.
     *
     * Quantity in this engine is denominated in UNITS, which is what Indian brokers
     * display ("65", not "1 lot"). That keeps `notional = qty × price` true, so nothing
     * in the pricing path needs a multiplier. Lot size only constrains which quantities
     * are legal.
     */
    lotSize: number;
    /** Index options only. European exercise, cash settlement — both are load-bearing. */
    style: 'european';
    settlement: 'cash';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** NSE quotes expiries as '18-Aug-2026'. Convert to an ISO date. */
export function nseExpiryToIso(expiry: string): string | null {
    const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(expiry.trim());
    if (!m) return null;
    const month = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
    if (month < 0) return null;
    const day = Number(m[1]);
    if (day < 1 || day > 31) return null;
    return `${m[3]}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Settlement instant for an expiry date: 15:30 IST, as epoch ms.
 *
 * IST is UTC+5:30 with no daylight saving, ever — so this is exact arithmetic rather
 * than a timezone lookup, and it stays correct without a tz database.
 */
export function expiryInstant(isoDate: string): number | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
    if (!m) return null;
    // 15:30 IST === 10:00 UTC.
    const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 10, 0, 0);
    return Number.isFinite(ms) ? ms : null;
}

/** Build the registry symbol for a contract. */
export function buildOptionSymbol(c: Pick<OptionContract, 'root' | 'expiry' | 'strike' | 'optionType'>): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c.expiry);
    if (!m) throw new Error(`Expiry must be YYYY-MM-DD, got "${c.expiry}"`);
    if (!Number.isInteger(c.strike) || c.strike <= 0) throw new Error(`Strike must be a positive integer, got ${c.strike}`);
    return `${c.root}${m[1].slice(2)}${m[2]}${m[3]}${c.strike}${c.optionType}`;
}

export interface ParsedSymbol {
    root: OptionRoot;
    expiry: string;
    strike: number;
    optionType: OptionType;
}

/** Parse a registry symbol back into its parts, or null if it is not an option symbol. */
export function parseOptionSymbol(symbol: string): ParsedSymbol | null {
    const s = symbol.trim().toUpperCase();
    const root = OPTION_ROOTS.find((r) => s.startsWith(r));
    if (!root) return null;

    const rest = s.slice(root.length);
    const m = /^(\d{2})(\d{2})(\d{2})(\d+)(CE|PE)$/.exec(rest);
    if (!m) return null;

    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const strike = Number(m[4]);
    if (!Number.isFinite(strike) || strike <= 0) return null;

    return {
        root,
        expiry: `20${m[1]}-${m[2]}-${m[3]}`,
        strike,
        optionType: m[5] as OptionType,
    };
}

/** True when a symbol names an option contract. Cheap, and does not need the registry. */
export function isOptionSymbol(symbol: string): boolean {
    return parseOptionSymbol(symbol) !== null;
}

/** Assemble a full contract. Returns null rather than guessing at any missing piece. */
export function makeContract(input: {
    root: OptionRoot;
    /** ISO date, or NSE's own '18-Aug-2026' form. */
    expiry: string;
    strike: number;
    optionType: OptionType;
    lotSize: number;
}): OptionContract | null {
    const expiry = /^\d{4}-\d{2}-\d{2}$/.test(input.expiry) ? input.expiry : nseExpiryToIso(input.expiry);
    if (!expiry) return null;

    const expiryMs = expiryInstant(expiry);
    if (expiryMs === null) return null;

    // A missing lot size is not defaultable: it decides the quantity step, and guessing
    // it mis-sizes every order in the contract by a whole multiple.
    if (!Number.isFinite(input.lotSize) || input.lotSize <= 0) return null;
    if (!Number.isInteger(input.strike) || input.strike <= 0) return null;

    return {
        root: input.root,
        underlying: UNDERLYING_OF[input.root],
        expiry,
        expiryMs,
        strike: input.strike,
        optionType: input.optionType,
        lotSize: Math.floor(input.lotSize),
        style: 'european',
        settlement: 'cash',
    };
}

/**
 * Shape check for a contract arriving from persisted or cloud-synced state.
 *
 * The registry accepts extra fields, so without this a malicious or corrupt
 * `watchlists` row could inject a bogus lotSize and mis-size every order in it.
 */
export function isValidOptionContract(v: unknown): v is OptionContract {
    if (!v || typeof v !== 'object') return false;
    const c = v as Partial<OptionContract>;
    return (
        typeof c.root === 'string' &&
        (OPTION_ROOTS as readonly string[]).includes(c.root) &&
        typeof c.underlying === 'string' &&
        typeof c.expiry === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(c.expiry) &&
        typeof c.expiryMs === 'number' &&
        Number.isFinite(c.expiryMs) &&
        typeof c.strike === 'number' &&
        Number.isFinite(c.strike) &&
        c.strike > 0 &&
        (c.optionType === 'CE' || c.optionType === 'PE') &&
        typeof c.lotSize === 'number' &&
        Number.isInteger(c.lotSize) &&
        c.lotSize > 0 &&
        c.style === 'european' &&
        c.settlement === 'cash'
    );
}

/** Human-readable form. The raw symbol is never shown as a heading. */
export function formatContract(c: Pick<OptionContract, 'root' | 'expiry' | 'strike' | 'optionType'>): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c.expiry);
    const date = m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : c.expiry;
    return `${c.root} ${date} ${c.strike} ${c.optionType}`;
}

/** Round a quantity down to a whole number of lots. Never rounds up into a bigger trade. */
export function floorToLot(qty: number, lotSize: number): number {
    if (!Number.isFinite(qty) || !Number.isFinite(lotSize) || lotSize <= 0) return 0;
    return Math.floor(qty / lotSize) * lotSize;
}

/** Whether a quantity is a legal multiple of the contract's lot size. */
export function isWholeLots(qty: number, lotSize: number): boolean {
    if (!Number.isFinite(qty) || qty <= 0 || lotSize <= 0) return false;
    return Math.abs(qty % lotSize) < 1e-9;
}
