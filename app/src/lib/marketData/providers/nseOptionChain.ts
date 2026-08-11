import 'server-only';
import { cachedFetch } from '../cache';

// NSE index option chains, for NIFTY and BANKNIFTY.
//
// VERIFIED LIVE during planning, and the details matter because most published guidance
// for this endpoint is out of date:
//
//   /api/option-chain-v3?type=Indices&symbol=NIFTY&expiry=11-Aug-2026
//       200 · 240KB · 113 strikes · underlyingValue 24471.7
//   /api/option-chain-contract-info?symbol=NIFTY
//       200 · the expiry list and strike list
//   /api/option-chain-indices?symbol=NIFTY        ← the endpoint every tutorial cites
//       404. It is GONE. Do not resurrect it.
//
// Two departures from `nseIpo.ts`, both deliberate.
//
// 1. COOKIE PRIMING. nseIpo gets away with four headers and no cookies. The chain does
//    not: it needs a jar warmed on the homepage and then on /option-chain, plus the
//    Sec-Fetch triplet. Node's fetch has no jar, so this module keeps one by hand.
//
// 2. A SEPARATE PROVIDER ID. `cachedFetch`'s circuit breaker is per-provider, and three
//    chain failures on the shared 'nse' id would take the IPO panel down for five
//    minutes as collateral damage. Same reasoning as binanceFunding splitting from
//    binance because fapi has independent availability.
//
// A caveat that cannot be fixed here: NSE blocks datacenter egress ranges hard. This is
// verified working from a local machine. On a serverless host it may return nothing, and
// the route says so rather than rendering as broken.

const PROVIDER = 'nse-options';
const LIMIT = { perMinute: 12 };

const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** The only underlyings this covers. Index options are European and cash-settled. */
export const OPTION_ROOTS = ['NIFTY', 'BANKNIFTY'] as const;
export type OptionRoot = (typeof OPTION_ROOTS)[number];

export function isOptionRoot(v: string): v is OptionRoot {
    return (OPTION_ROOTS as readonly string[]).includes(v);
}

export interface OptionQuote {
    lastPrice: number | null;
    /**
     * NSE's own implied volatility. Null when NSE reports 0, which it does on deep-ITM
     * and illiquid strikes — that is a missing figure, not a claim that volatility is
     * zero, and collapsing the two would make our own solver look wrong.
     */
    impliedVolatility: number | null;
    openInterest: number | null;
    changeInOpenInterest: number | null;
    bid: number | null;
    ask: number | null;
}

export interface ChainStrike {
    strike: number;
    call: OptionQuote | null;
    put: OptionQuote | null;
}

export interface OptionChain {
    symbol: OptionRoot;
    expiry: string;
    /** Spot level of the underlying index, as NSE reports it alongside the chain. */
    underlying: number | null;
    /** NSE's own timestamp string. Kept raw — its format is not ISO. */
    quotedAt: string | null;
    strikes: ChainStrike[];
}

export interface ContractInfo {
    symbol: OptionRoot;
    /** Every listed expiry, as NSE formats them (DD-MMM-YYYY). Weeklies first. */
    expiries: string[];
    strikes: number[];
}

/**
 * `cachedFetch` treats a null fetcher result as a FAILURE and counts it toward the
 * circuit breaker. "This symbol genuinely has no chain" must therefore be a non-null
 * value, or a quiet expiry would trip the breaker. Same wrapper as finnhubFundamentals.
 */
interface Answer<T> {
    data: T | null;
}

const numOrNull = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
};

/** Zero IV from NSE means "not computed", not "no volatility". */
const ivOrNull = (v: unknown): number | null => {
    const n = numOrNull(v);
    return n === null || n <= 0 ? null : n;
};

/* ------------------------------------------------------------------- cookie jar */

let jar = '';
let jarAt = 0;
const JAR_TTL_MS = 10 * 60_000;

function absorb(res: Response) {
    // Node 18+ exposes getSetCookie; without it, multiple Set-Cookie headers collapse
    // into one string and the jar would be malformed.
    const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    if (!raw.length) return;
    const pairs = new Map(
        jar
            .split('; ')
            .filter(Boolean)
            .map((c) => [c.slice(0, c.indexOf('=')), c] as const)
    );
    for (const line of raw) {
        const first = line.split(';')[0];
        const eq = first.indexOf('=');
        if (eq > 0) pairs.set(first.slice(0, eq), first);
    }
    jar = [...pairs.values()].join('; ');
}

const browserHeaders = (referer: string): Record<string, string> => ({
    'user-agent': UA,
    accept: 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    referer,
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
    ...(jar ? { cookie: jar } : {}),
});

/**
 * Warm the jar.
 *
 * The homepage itself answers 403 to us and that is fine — it still sets the cookies the
 * API endpoints check, which is why the response status is deliberately ignored here.
 */
async function primeJar(): Promise<void> {
    if (jar && Date.now() - jarAt < JAR_TTL_MS) return;
    jar = '';
    for (const url of ['https://www.nseindia.com/', 'https://www.nseindia.com/option-chain']) {
        try {
            const res = await fetch(url, {
                headers: {
                    'user-agent': UA,
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'accept-language': 'en-US,en;q=0.9',
                    ...(jar ? { cookie: jar } : {}),
                },
                cache: 'no-store',
            });
            absorb(res);
        } catch {
            // A failed prime is not fatal — the request that follows will fail with a
            // status we can actually report, which is more useful than throwing here.
        }
    }
    jarAt = Date.now();
}

async function nseJson(url: string, referer: string): Promise<unknown | null> {
    await primeJar();
    let res = await fetch(url, { headers: browserHeaders(referer), cache: 'no-store' });

    // A stale jar reads as a block. Re-prime once and retry before giving up, so a
    // ten-minute-old cookie does not surface to the user as "NSE is down".
    if (!res.ok) {
        jar = '';
        jarAt = 0;
        await primeJar();
        res = await fetch(url, { headers: browserHeaders(referer), cache: 'no-store' });
    }
    if (!res.ok) return null;

    // NSE answers its block page as HTML with a 200 on some paths.
    const text = await res.text();
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

/* ------------------------------------------------------------------- endpoints */

/**
 * Expiries and strikes for a root.
 *
 * Must be called before `optionChain` — v3 returns a 200 with an EMPTY data array for an
 * expiry that is not listed, which is indistinguishable from "no contracts" unless you
 * already know the valid set.
 */
export async function contractInfo(symbol: OptionRoot): Promise<Answer<ContractInfo> | null> {
    return cachedFetch<Answer<ContractInfo>>(
        // The expiry list changes when a contract expires — daily at most.
        { provider: PROVIDER, key: `info:${symbol}`, ttlMs: 30 * 60_000, limit: LIMIT },
        async () => {
            const json = await nseJson(
                `https://www.nseindia.com/api/option-chain-contract-info?symbol=${encodeURIComponent(symbol)}`,
                'https://www.nseindia.com/option-chain'
            );
            if (!json || typeof json !== 'object') return null;

            const j = json as { expiryDates?: unknown; strikePrice?: unknown };
            const expiries = Array.isArray(j.expiryDates) ? j.expiryDates.filter((e): e is string => typeof e === 'string') : [];
            const strikes = Array.isArray(j.strikePrice)
                ? j.strikePrice.map(numOrNull).filter((n): n is number => n !== null)
                : [];

            if (!expiries.length) return { data: null };
            return { data: { symbol, expiries, strikes } };
        }
    );
}

export async function optionChain(symbol: OptionRoot, expiry: string): Promise<Answer<OptionChain> | null> {
    return cachedFetch<Answer<OptionChain>>(
        // Premiums move every tick, but the free-tier discipline matters more than
        // freshness here and the screen states the quote time.
        { provider: PROVIDER, key: `chain:${symbol}:${expiry}`, ttlMs: 60_000, limit: LIMIT },
        async () => {
            const json = await nseJson(
                `https://www.nseindia.com/api/option-chain-v3?type=Indices&symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`,
                'https://www.nseindia.com/option-chain'
            );
            if (!json || typeof json !== 'object') return null;

            const records = (json as { records?: { data?: unknown; underlyingValue?: unknown; timestamp?: unknown } }).records;
            const rows = Array.isArray(records?.data) ? records.data : [];

            // 200 with an empty array is what an unlisted expiry returns. Report it as
            // "covered, nothing there" rather than as a fetch failure.
            if (!rows.length) return { data: null };

            const quote = (side: unknown): OptionQuote | null => {
                if (!side || typeof side !== 'object') return null;
                const s = side as Record<string, unknown>;
                return {
                    lastPrice: numOrNull(s.lastPrice),
                    impliedVolatility: ivOrNull(s.impliedVolatility),
                    openInterest: numOrNull(s.openInterest),
                    changeInOpenInterest: numOrNull(s.changeinOpenInterest),
                    bid: numOrNull(s.buyPrice1),
                    ask: numOrNull(s.sellPrice1),
                };
            };

            const strikes: ChainStrike[] = rows
                .map((row) => {
                    const r = row as { strikePrice?: unknown; CE?: unknown; PE?: unknown };
                    const strike = numOrNull(r.strikePrice);
                    return strike === null ? null : { strike, call: quote(r.CE), put: quote(r.PE) };
                })
                .filter((s): s is ChainStrike => s !== null)
                .sort((a, b) => a.strike - b.strike);

            return {
                data: {
                    symbol,
                    expiry,
                    underlying: numOrNull(records?.underlyingValue),
                    quotedAt: typeof records?.timestamp === 'string' && records.timestamp.trim() ? records.timestamp : null,
                    strikes,
                },
            };
        }
    );
}

/* -------------------------------------------------------------------- lot sizes */

/**
 * Contract lot sizes, parsed from NSE's published F&O contract master.
 *
 *   https://nsearchives.nseindia.com/content/fo/fo_mktlots.csv  → 200, ~46KB, no cookie
 *
 * Parsed rather than hardcoded, and the reason is specific: the file is PER EXPIRY.
 * SEBI revisions take effect from a future expiry, so a single constant is wrong for
 * part of the chain from the day it changes. NIFTY is 65 and BANKNIFTY 30 today — not
 * the 75/35 that older material still quotes, which is the argument in one line.
 *
 * Different host, so a different provider id: an archive outage must not open the
 * circuit on the chain endpoint or vice versa.
 */
export interface LotSizes {
    /** Lot size per expiry column header, e.g. { 'AUG-26': 65 }. */
    byExpiryMonth: Record<string, number>;
    /** The nearest column, used when an expiry month is not listed. */
    nearest: number | null;
}

export async function lotSizes(symbol: OptionRoot): Promise<Answer<LotSizes> | null> {
    return cachedFetch<Answer<LotSizes>>(
        { provider: 'nse-archives', key: `lots:${symbol}`, ttlMs: 12 * 3_600_000, limit: { perMinute: 4 } },
        async () => {
            // Note: archives.nseindia.com 301-redirects. nsearchives is the live host.
            const res = await fetch('https://nsearchives.nseindia.com/content/fo/fo_mktlots.csv', {
                headers: { 'user-agent': UA, accept: 'text/csv,text/plain,*/*' },
                cache: 'no-store',
            });
            if (!res.ok) return null;

            const text = await res.text();
            const lines = text.split('\n').filter((l) => l.trim());
            if (lines.length < 2) return null;

            const header = lines[0].split(',').map((c) => c.trim());
            const symbolCol = header.findIndex((c) => c.toUpperCase() === 'SYMBOL');
            if (symbolCol < 0) return null;

            const row = lines.slice(1).find((l) => {
                const cells = l.split(',');
                return (cells[symbolCol] ?? '').trim().toUpperCase() === symbol;
            });
            if (!row) return { data: null };

            const cells = row.split(',').map((c) => c.trim());
            const byExpiryMonth: Record<string, number> = {};
            let nearest: number | null = null;

            for (let i = symbolCol + 1; i < header.length; i++) {
                const size = numOrNull(cells[i]);
                if (size === null || size <= 0) continue;
                byExpiryMonth[header[i].toUpperCase()] = size;
                if (nearest === null) nearest = size;
            }

            return Object.keys(byExpiryMonth).length ? { data: { byExpiryMonth, nearest } } : { data: null };
        }
    );
}

/** Map an NSE expiry string ('18-Aug-2026') onto a contract-master column ('AUG-26'). */
export function expiryMonthKey(expiry: string): string | null {
    const m = /^\d{1,2}-([A-Za-z]{3})-(\d{4})$/.exec(expiry.trim());
    return m ? `${m[1].toUpperCase()}-${m[2].slice(2)}` : null;
}

/** The lot size that applies to a given expiry, or null when the master is unavailable. */
export function lotSizeFor(sizes: LotSizes | null, expiry: string): number | null {
    if (!sizes) return null;
    const key = expiryMonthKey(expiry);
    return (key && sizes.byExpiryMonth[key]) || sizes.nearest;
}
