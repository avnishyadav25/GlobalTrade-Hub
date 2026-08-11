import 'server-only';
import { cachedFetch } from '../cache';

// US Energy Information Administration — weekly petroleum stocks (EIA API v2).
//
// Series WCESTUS1: "U.S. Ending Stocks excluding SPR of Crude Oil", in thousand
// barrels, published Wednesdays ~10:30 ET for the week ending the prior Friday.
// This is the print that moves WTI/USD (CL=F) on Wednesday mornings.
//
// The key is free but must be registered (https://www.eia.gov/opendata/register.php)
// and EIA_API_KEY is NOT set in this repo. Every export below therefore returns null
// today, and callers must surface that as "not configured" — there is deliberately
// no synthetic series behind this module, because a plausible-looking fake crude
// draw is exactly the kind of number a user would trade on.
//
// EIA publishes ACTUALS ONLY. Nothing in this response carries a market consensus
// or forecast, so "surprise vs consensus" cannot be derived here; it needs a
// separate survey source (an analyst poll or an economic-calendar provider). That
// estimate is intentionally not stubbed: pairing a real print with an invented
// expectation would fabricate the signal rather than report it.
export const CRUDE_STOCKS_SERIES = 'WCESTUS1';

/** EIA reports this series in thousand barrels (its own unit code is MBBL). */
export const CRUDE_STOCKS_UNITS = 'thousand barrels';

// One upstream call serves every caller: the same fixed window is always fetched
// and sliced locally, so a panel asking for 8 weeks and a chart asking for 52 cost
// one request between them rather than two. The data only changes once a week, so
// the TTL is hours, not seconds.
const FETCH_ROWS = 261; // ~5 years of weekly observations
const TTL_MS = 6 * 60 * 60_000;
const LIMIT = { perMinute: 5, perDay: 200 };

const DAY_S = 86_400;
/** A weekly series is exactly 7 days apart; the slack absorbs a shifted holiday week. */
const MAX_WEEK_GAP_S = 8 * DAY_S;

export interface InventoryPoint {
    /** Week-ending date, unix seconds at UTC midnight. */
    time: number;
    /** Stocks level, in thousand barrels (see CRUDE_STOCKS_UNITS). */
    value: number;
    /**
     * Week-on-week change in thousand barrels; negative is a draw.
     * Null when the preceding week is unavailable — a missing prior must not read
     * as an unchanged week, and zero would say exactly that.
     */
    changeFromPrior: number | null;
}

export interface InventoryShock {
    time: number;
    value: number;
    /** Week-on-week change in thousand barrels; negative is a draw. */
    change: number;
    /** The same change as a percentage of the prior week's level. */
    changePct: number;
}

interface EiaRow {
    period?: unknown;
    value?: unknown;
}

interface Observation {
    time: number;
    value: number;
}

/** EIA types `value` per route: some return a JSON number, others a numeric string. */
function toNumber(v: unknown): number | null {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string' && v.trim() !== '') {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

/** EIA's weekly dateFormat is 'YYYY-MM-DD'; anything else is not a week we can place. */
function periodToUnix(period: unknown): number | null {
    if (typeof period !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(period)) return null;
    const ms = Date.parse(`${period}T00:00:00Z`);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function parseSeries(json: unknown): Observation[] {
    const rows = (json as { response?: { data?: unknown } } | null)?.response?.data;
    if (!Array.isArray(rows)) return [];

    const out: Observation[] = [];
    for (const row of rows as EiaRow[]) {
        const time = periodToUnix(row?.period);
        const value = toNumber(row?.value);
        // A week EIA has not published, or has withheld, arrives with value null.
        // Dropping it is the only honest option: interpolating would invent a stock
        // level, and coercing to zero would render as a 400-million-barrel draw.
        if (time == null || value == null) continue;
        out.push({ time, value });
    }

    // The request asks for newest-first so that `length` truncates the OLDEST weeks
    // rather than the ones we care about; sorting here means callers get
    // chronological order whatever the upstream ordering turns out to be.
    out.sort((a, b) => a.time - b.time);
    return out;
}

async function fetchSeries(apiKey: string): Promise<Observation[] | null> {
    // FETCH_ROWS is in the cache key so that raising it later cannot serve a shorter
    // window that was cached under the old value.
    return cachedFetch<Observation[]>(
        { provider: 'eia', key: `stocks:${CRUDE_STOCKS_SERIES}:${FETCH_ROWS}`, ttlMs: TTL_MS, limit: LIMIT },
        async () => {
            const qs = new URLSearchParams({
                api_key: apiKey,
                frequency: 'weekly',
                length: String(FETCH_ROWS),
            });
            qs.append('data[0]', 'value');
            qs.append('facets[series][]', CRUDE_STOCKS_SERIES);
            qs.append('sort[0][column]', 'period');
            qs.append('sort[0][direction]', 'desc');

            const res = await fetch(`https://api.eia.gov/v2/petroleum/stoc/wstk/data/?${qs.toString()}`, {
                cache: 'no-store',
            });
            // A rejected key answers 403. Returning null rather than throwing lets the
            // shared circuit breaker back off instead of retrying a key that will not
            // start working on its own.
            if (!res.ok) return null;

            const parsed = parseSeries(await res.json());
            return parsed.length ? parsed : null;
        }
    );
}

function clampWeeks(weeks: number): number {
    if (!Number.isFinite(weeks)) return 1;
    return Math.min(FETCH_ROWS, Math.max(1, Math.floor(weeks)));
}

/** Whether EIA_API_KEY is present. False means every function here returns null. */
export function eiaConfigured(): boolean {
    // Trimmed, because a blank `EIA_API_KEY=` line in .env.local would otherwise read
    // as configured and drive the UI into claiming data it is about to be 403'd out of.
    return Boolean(process.env.EIA_API_KEY?.trim());
}

/**
 * Weekly US crude stocks excluding the SPR, oldest first, in thousand barrels.
 * Returns null when the key is absent or upstream gave us nothing usable — never a
 * partial or placeholder series.
 */
export async function crudeInventories(weeks = 52): Promise<InventoryPoint[] | null> {
    const apiKey = process.env.EIA_API_KEY?.trim();
    if (!apiKey) return null;

    const series = await fetchSeries(apiKey);
    if (!series?.length) return null;

    const points: InventoryPoint[] = series.map((obs, i) => {
        const prev = i > 0 ? series[i - 1] : null;
        // Changes are computed across the FULL fetched series before slicing, so the
        // first week of the returned window still carries a real week-on-week change
        // instead of a hole. The gap check matters because dropped weeks close up in
        // the array: a fortnight's build presented as a weekly one would double the
        // apparent move.
        const contiguous = prev != null && obs.time - prev.time <= MAX_WEEK_GAP_S;
        return {
            time: obs.time,
            value: obs.value,
            changeFromPrior: contiguous ? obs.value - prev.value : null,
        };
    });

    return points.slice(-clampWeeks(weeks));
}

/**
 * The most recent weekly print with its week-on-week change. Null when the key is
 * absent, or when the preceding week is missing and the change cannot be stated.
 * `changePct` is a percentage of the prior week's level, not a fraction.
 */
export async function latestInventoryShock(): Promise<InventoryShock | null> {
    // Two weeks is all this needs; the underlying fetch is the same cached window
    // either way, so the narrow slice costs nothing upstream.
    const points = await crudeInventories(2);
    if (!points?.length) return null;

    const latest = points[points.length - 1];
    if (latest.changeFromPrior == null) return null;

    const prior = latest.value - latest.changeFromPrior;
    // National crude stocks cannot be zero, but guard rather than emit Infinity.
    if (!Number.isFinite(prior) || prior === 0) return null;

    return {
        time: latest.time,
        value: latest.value,
        change: latest.changeFromPrior,
        changePct: (latest.changeFromPrior / prior) * 100,
    };
}
