import 'server-only';
import { cachedFetch } from '../cache';

// Finnhub earnings calendar: /calendar/earnings.
//
// SCOPE — US LISTINGS ONLY, the same limit as the rest of the free Finnhub tier.
// Indian earnings dates are not available from any free API (Alpha Vantage returns
// `{}` for RELIANCE.BSE — verified), so there is nothing to fall through to. An
// Indian symbol asked for here comes back empty; the calling surface must say the
// market is unsupported rather than present an empty calendar as "no earnings due".
//
// The endpoint is generous rather than paginated: a two-week window returned 1,222
// rows (verified), so a month of the whole market is a multi-megabyte parse held in
// the shared response cache. Pass `symbol` whenever it is known — Finnhub filters
// server-side and the payload collapses to a handful of rows.

// One token bucket per API KEY, not per endpoint: Finnhub's free allowance is
// account-wide, so this shares the `finnhub` provider id with the live quote feed
// in providers/finnhub.ts and with finnhubFundamentals.ts.
const PROVIDER = 'finnhub';
const LIMIT = { perMinute: 50 };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SYMBOL_RE = /^[A-Z0-9.-]{1,15}$/;

// Exchange suffixes this app can produce that Finnhub is known not to cover. The
// list is the India book, not a world atlas. Screening them out is not cosmetic: an
// uncovered symbol answers 403, `cachedFetch` counts that as a provider failure, and
// the circuit breaker is shared with the live US quote feed, so three India lookups
// in a row would pause US quotes for five minutes.
const UNSUPPORTED_SUFFIX = /\.(NS|BO|BSE|NSE)$/;

export type EarningsHour = 'bmo' | 'amc' | 'dmh';

export interface EarningsEvent {
    symbol: string;
    /** Exchange-local calendar date, YYYY-MM-DD. Not a timestamp: Finnhub reports
     *  the session, and `hour` says where in it the release falls. */
    date: string;
    epsActual: number | null;
    epsEstimate: number | null;
    revenueActual: number | null;
    revenueEstimate: number | null;
    /**
     * bmo = before market open, amc = after market close, dmh = during market
     * hours. Null when Finnhub sends an empty string, which it does for dates it
     * has not confirmed — null means unknown, NOT "during hours".
     */
    hour: EarningsHour | null;
    quarter: number | null;
    year: number | null;
}

interface CalendarResponse {
    /** Nullable elements are not paranoia: this is parsed JSON, and every field is
     *  `unknown` precisely so nothing here is assumed to have arrived. */
    earningsCalendar?: (RawRow | null)[];
}

interface RawRow {
    symbol?: unknown;
    date?: unknown;
    epsActual?: unknown;
    epsEstimate?: unknown;
    revenueActual?: unknown;
    revenueEstimate?: unknown;
    hour?: unknown;
    quarter?: unknown;
    year?: unknown;
}

/**
 * Separates "upstream answered, and the window is genuinely empty" from "upstream
 * failed". `cachedFetch` counts a null fetcher result as a provider failure and its
 * circuit breaker is shared with the live quote feed, so an empty calendar must not
 * be reported as an outage.
 */
interface Answer<T> {
    data: T | null;
}

let warnedUnconfigured = false;

function apiKey(): string | null {
    const key = process.env.FINNHUB_API_KEY;
    if (key) return key;
    if (!warnedUnconfigured) {
        warnedUnconfigured = true;
        console.warn('[marketdata] finnhub earnings not configured — set FINNHUB_API_KEY. No data will be returned.');
    }
    return null;
}

/**
 * False when FINNHUB_API_KEY is absent. Exposed so a caller can render an explicit
 * "not configured" state rather than an empty calendar, which would read as a
 * confident "nothing reports this week".
 */
export function finnhubEarningsConfigured(): boolean {
    return Boolean(process.env.FINNHUB_API_KEY);
}

function num(value: unknown): number | null {
    // A missing estimate stays null. Zero is a legitimate EPS estimate, so it can
    // never double as the "absent" marker.
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function int(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

/** Uppercased so `aapl` and `AAPL` collapse onto one cache entry, and screened so a
 *  symbol Finnhub cannot serve never reaches the shared token bucket. */
function normalizeSymbol(symbol: string): string | null {
    const s = symbol.trim().toUpperCase();
    if (!SYMBOL_RE.test(s) || UNSUPPORTED_SUFFIX.test(s)) return null;
    return s;
}

function toHour(value: unknown): EarningsHour | null {
    return value === 'bmo' || value === 'amc' || value === 'dmh' ? value : null;
}

function parseRow(raw: RawRow | null): EarningsEvent | null {
    const symbol = typeof raw?.symbol === 'string' ? raw.symbol.trim().toUpperCase() : '';
    const date = typeof raw?.date === 'string' ? raw.date.trim() : '';
    // A row with no symbol or no usable date cannot be placed on a calendar. Drop it
    // rather than emit a blank line that a user reads as a rendering fault.
    if (!symbol || !DATE_RE.test(date)) return null;
    return {
        symbol,
        date,
        epsActual: num(raw?.epsActual),
        epsEstimate: num(raw?.epsEstimate),
        revenueActual: num(raw?.revenueActual),
        revenueEstimate: num(raw?.revenueEstimate),
        hour: toHour(raw?.hour),
        quarter: int(raw?.quarter),
        year: int(raw?.year),
    };
}

/**
 * Earnings events between two inclusive YYYY-MM-DD dates, optionally for one
 * symbol.
 *
 * Returns `[]` when the window holds no events and `null` when nothing could be
 * fetched — no key, a malformed window, or an upstream failure. Callers must not
 * treat the two alike: one is an answer, the other is the absence of one.
 */
export async function earningsCalendar(from: string, to: string, symbol?: string): Promise<EarningsEvent[] | null> {
    const token = apiKey();
    if (!token) return null;

    // Lexicographic comparison is valid for zero-padded ISO dates, so no Date
    // parsing is needed — and none is wanted, since `new Date('2026-13-40')` would
    // quietly roll over into a real date rather than reject.
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
        // Null rather than a throw: every provider in this layer signals "nothing
        // usable" with null, and a route handling a user-supplied date must not 500.
        // The warning is what keeps the rejection from being silent.
        console.warn(`[marketdata] finnhub earnings: ignoring malformed window ${from}..${to}`);
        return null;
    }

    let sym: string | null = null;
    if (symbol !== undefined) {
        sym = normalizeSymbol(symbol);
        if (!sym) {
            // Falling back to an unfiltered query would answer a question about one
            // company with the whole market, and spend a big payload doing it.
            console.warn(`[marketdata] finnhub earnings: ignoring unsupported symbol ${symbol}`);
            return null;
        }
    }

    const query = new URLSearchParams({ from, to, token });
    if (sym) query.set('symbol', sym);

    const answer = await cachedFetch<Answer<(RawRow | null)[]>>(
        {
            provider: PROVIDER,
            // The symbol belongs in the cache key: the filtered and unfiltered
            // responses for one from/to pair are different documents. The token
            // never does — cache keys end up in logs.
            key: `earnings:${from}:${to}:${sym ?? '*'}`,
            // 30 min. Actual EPS lands after the close and scheduled dates shift by
            // days, so this costs no freshness; the point is that a page reload must
            // not re-pull several hundred rows.
            ttlMs: 30 * 60_000,
            limit: LIMIT,
        },
        async () => {
            const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?${query.toString()}`, {
                cache: 'no-store',
            });
            if (!res.ok) return null;
            const body: CalendarResponse | null = await res.json();
            const rows = body?.earningsCalendar;
            return { data: Array.isArray(rows) ? rows : null };
        }
    );

    // No answer at all, or an answer whose shape we do not recognise. Either way we
    // know nothing, and an empty array here would claim we did.
    if (!answer?.data) return null;

    const events = answer.data.map(parseRow).filter((e): e is EarningsEvent => e !== null);
    // Belt and braces: should the upstream symbol filter ever be ignored, a caller
    // that asked about one company must not silently receive the whole market.
    const scoped = sym ? events.filter((e) => e.symbol === sym) : events;
    // Upstream ordering is undocumented. Sort so two identical requests render the
    // same list, and so a "next up" reader can take the head.
    return scoped.sort((a, b) => (a.date === b.date ? a.symbol.localeCompare(b.symbol) : a.date.localeCompare(b.date)));
}

/**
 * EPS surprise as a percentage of the estimate, or null when it cannot be computed.
 *
 * Null when either side is missing: a missing estimate is not a zero estimate, and
 * treating it as one would turn every unforecast report into a 100% beat.
 */
export function epsSurprisePct(e: Pick<EarningsEvent, 'epsActual' | 'epsEstimate'>): number | null {
    const { epsActual: actual, epsEstimate: estimate } = e;
    if (actual == null || estimate == null) return null;
    // A zero estimate makes the surprise infinite, which is not a number any surface
    // can render — and "∞% beat" for a 0.01 result would be absurd besides.
    if (estimate === 0) return null;
    // Denominator is |estimate|, not estimate. A company forecast to lose 0.50 that
    // loses only 0.30 has beaten; dividing by the signed estimate would report that
    // genuine beat as −40%.
    return ((actual - estimate) / Math.abs(estimate)) * 100;
}
