import 'server-only';
import { cachedFetch } from '../cache';

// Binance USDⓈ-M perpetual funding rates.
//
// WHAT THIS IS AND IS NOT — read before wiring it to any surface.
//
// Funding is the periodic payment between perpetual longs and shorts that keeps the
// perp price pinned to spot. A persistently positive rate means longs are crowded and
// paying to stay in; a negative one means the reverse. That is a genuine positioning
// signal, and it is the ONLY thing this module supports.
//
// It is NOT tradeable here. The standard use of these numbers is the cash-and-carry
// basis trade — buy spot, short the perp, collect funding — and this app cannot execute
// that trade in any form: the paper engine has no perpetual-futures instrument, no
// short-perp leg and no funding accrual, so there is nothing to hold and nothing to pay
// or receive. `annualisedCarry()` therefore describes a yield that no user of this app
// can capture. Any surface rendering it must say so plainly; presenting it as an
// achievable return would be a fabricated number attached to a strategy that does not
// exist.
//
// No API key is involved: `fundingRate` and `premiumIndex` on fapi.binance.com are
// public endpoints, so there is no missing-key failure mode to report. What can still
// make this unavailable is (a) the Binance feed being switched off with
// NEXT_PUBLIC_ENABLE_BINANCE_FEED=false, and (b) a symbol with no perpetual contract.
// Both are reported through `fundingAvailability()` with a sentence a surface can show,
// because the alternative — an empty chart, or worse a zero — reads as "carry is flat",
// which is a real and completely wrong signal.

/**
 * App symbol -> Binance USDⓈ-M perpetual contract.
 *
 * Deliberately local rather than an edit to `./symbols.ts`: the entries there are spot
 * pairs, and these are perpetual contracts that merely happen to share a ticker. They
 * are distinct universes — a spot pair can exist with no perp, and Binance delists perps
 * independently — so merging them needs a decision about how the two are keyed. Fold
 * this into `symbols.ts` as a separate `BINANCE_PERP_SYMBOLS` export when that happens.
 */
export const BINANCE_PERP_SYMBOLS: Record<string, string> = {
    'BTC/USDT': 'BTCUSDT',
    'ETH/USDT': 'ETHUSDT',
    'SOL/USDT': 'SOLUSDT',
};

// A provider id of its own, NOT the 'binance' bucket that binanceRest uses. fapi is a
// separate host with separate availability — it answers 451 in restricted regions while
// api.binance.com keeps working — so sharing a circuit breaker would let a geo-blocked
// funding call knock out spot quotes for five minutes.
const PROVIDER = 'binance-funding';
const BASE = 'https://fapi.binance.com/fapi/v1';
const LIMIT = { perMinute: 60 };

/** Funding settles every 8 hours on Binance perpetuals. */
const SETTLEMENTS_PER_DAY = 3;
const SETTLEMENTS_PER_YEAR = SETTLEMENTS_PER_DAY * 365;

/** Binance caps `fundingRate` at 1000 rows and rejects a limit above it. */
const MAX_HISTORY = 1000;

/** One settled funding payment. */
export interface FundingPoint {
    /** Settlement time in unix SECONDS — Binance sends milliseconds. */
    time: number;
    /** Funding rate as a decimal fraction for that 8h interval: 0.0001 is 1bp. */
    rate: number;
}

export interface CurrentFunding {
    /**
     * Binance calls this `lastFundingRate`, but on a perpetual it moves continuously
     * with the premium index between settlements. Treat it as the rate currently
     * indicated for `nextFundingTime`, not as a settled figure — settled figures come
     * from `fundingHistory()`.
     */
    rate: number;
    /** Next settlement in unix SECONDS, matching `FundingPoint.time`. */
    nextFundingTime: number;
    markPrice: number;
    indexPrice: number;
}

export type FundingAvailability =
    | { available: true; perpSymbol: string }
    | { available: false; reason: 'unsupported-symbol' | 'feed-disabled'; detail: string };

/**
 * Whether funding data can be fetched for this symbol, and if not, why — as a sentence
 * intended to be shown to the user rather than swallowed.
 */
export function fundingAvailability(appSymbol: string): FundingAvailability {
    // Symbol before feed flag: "this instrument has no perpetual" is permanent and
    // specific, whereas the flag is a toggle. Reporting the toggle first would make the
    // explanation for, say, RELIANCE change when an unrelated setting is flipped.
    const perpSymbol = BINANCE_PERP_SYMBOLS[appSymbol];
    if (!perpSymbol) {
        return {
            available: false,
            reason: 'unsupported-symbol',
            detail: `${appSymbol} has no Binance perpetual contract mapped, so it has no funding rate.`,
        };
    }
    if (process.env.NEXT_PUBLIC_ENABLE_BINANCE_FEED === 'false') {
        return {
            available: false,
            reason: 'feed-disabled',
            detail: 'The Binance feed is switched off (NEXT_PUBLIC_ENABLE_BINANCE_FEED=false), so funding rates are not being fetched.',
        };
    }
    return { available: true, perpSymbol };
}

/**
 * Binance sends every number as a decimal string. Parse strictly and return null on
 * anything unusable, because the loose alternatives all fabricate: `Number('')` and
 * `Number(null)` are both 0, and a zero funding rate is a perfectly valid reading that
 * means "carry is flat". Coercing a missing field into one invents a signal.
 */
function num(v: unknown): number | null {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string' || v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

interface RawFundingRate {
    symbol?: unknown;
    fundingTime?: unknown;
    fundingRate?: unknown;
}

interface RawPremiumIndex {
    markPrice?: unknown;
    indexPrice?: unknown;
    lastFundingRate?: unknown;
    nextFundingTime?: unknown;
}

/**
 * Settled funding rates, oldest first. Returns null when unavailable — never an empty
 * array standing in for "no data", which a chart would happily draw as a flat line.
 */
export async function fundingHistory(appSymbol: string, limit = 100): Promise<FundingPoint[] | null> {
    const avail = fundingAvailability(appSymbol);
    if (!avail.available) return null;

    const n = Math.min(MAX_HISTORY, Math.max(1, Math.floor(limit)));
    return cachedFetch<FundingPoint[]>(
        // 15 min: a new point can only appear every 8 hours, so this is generous even
        // against the freshest row, and it makes a chart redraw cost nothing upstream.
        { provider: PROVIDER, key: `h:${avail.perpSymbol}:${n}`, ttlMs: 15 * 60_000, limit: LIMIT },
        async () => {
            const res = await fetch(`${BASE}/fundingRate?symbol=${avail.perpSymbol}&limit=${n}`, {
                cache: 'no-store',
            });
            if (!res.ok) return null;
            const body: unknown = await res.json();
            // Errors come back as an object ({ code, msg }), successes as an array.
            if (!Array.isArray(body)) return null;

            const out: FundingPoint[] = [];
            for (const row of body as RawFundingRate[]) {
                const rate = num(row?.fundingRate);
                const ms = num(row?.fundingTime);
                if (rate === null || ms === null || ms <= 0) continue;
                out.push({ time: Math.floor(ms / 1000), rate });
            }
            // Binance returns ascending already; sorting makes the contract ours rather
            // than theirs, since callers diff consecutive points.
            out.sort((a, b) => a.time - b.time);
            return out.length ? out : null;
        }
    );
}

/**
 * The rate currently indicated for the next settlement, with the mark and index prices
 * it is derived from. Returns null if any of the four is unusable: a partial reading
 * would leave a caller to fill the gap, and the only honest fill is "unavailable".
 */
export async function currentFunding(appSymbol: string): Promise<CurrentFunding | null> {
    const avail = fundingAvailability(appSymbol);
    if (!avail.available) return null;

    return cachedFetch<CurrentFunding>(
        // 30s: the mark price and the indicated rate both move continuously, so this is
        // the one call here that is worth refreshing on roughly a quote cadence.
        { provider: PROVIDER, key: `c:${avail.perpSymbol}`, ttlMs: 30_000, limit: LIMIT },
        async () => {
            const res = await fetch(`${BASE}/premiumIndex?symbol=${avail.perpSymbol}`, { cache: 'no-store' });
            if (!res.ok) return null;
            const body = (await res.json()) as RawPremiumIndex | RawPremiumIndex[];
            // Without a symbol, premiumIndex returns every contract; a caller that
            // reached here always passed one, so an array means something is wrong.
            if (Array.isArray(body)) return null;

            const rate = num(body?.lastFundingRate);
            const nextMs = num(body?.nextFundingTime);
            const markPrice = num(body?.markPrice);
            const indexPrice = num(body?.indexPrice);
            if (rate === null || nextMs === null || nextMs <= 0 || markPrice === null || indexPrice === null) {
                return null;
            }
            return { rate, nextFundingTime: Math.floor(nextMs / 1000), markPrice, indexPrice };
        }
    );
}

/**
 * Annualise one 8-hour funding rate, as a decimal fraction per year: 0.0001 (1bp per
 * interval) becomes 0.1095, i.e. 10.95%.
 *
 * Simple, not compounded, and an extrapolation rather than a forecast — it assumes the
 * current rate holds for a year, which it never does. Two naive alternatives it avoids:
 * multiplying by 365 alone understates by 3x because funding settles three times a day,
 * and compounding ((1+r)^1095 - 1) implies reinvesting each settlement, which is not a
 * thing this app can do — see the header on why none of this is executable here.
 *
 * NaN in, NaN out, deliberately: there is no sensible neutral carry to substitute for a
 * rate that was never read.
 */
export function annualisedCarry(rate: number): number {
    return rate * SETTLEMENTS_PER_YEAR;
}
