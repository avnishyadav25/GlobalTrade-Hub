// Black-Scholes pricing, an implied-volatility solver, and the Greeks.
//
// European exercise only, which is not a simplification here: Indian INDEX options are
// European and cash-settled, so this is the correct model rather than an approximation
// of one. Stock options are American and physically settled — they are not covered, and
// nothing in this module should be pointed at them.
//
// Pure, dependency-free and deterministic. No dates, no clock, no I/O: time to expiry
// arrives as a number of years, computed by the caller. That keeps this testable against
// published reference values and keeps timezone handling out of the pricing path.
//
// WHY THIS EXISTS when NSE publishes its own IV: NSE reports 0 for illiquid and deep-ITM
// strikes, and that is not rare — 38 of 105 strikes on a live NIFTY expiry had none.
// A chain that is one-third blank is a chain you cannot reason about.

export type OptionType = 'CE' | 'PE';

export interface PriceInputs {
    /** Spot price of the underlying. */
    spot: number;
    strike: number;
    /** Time to expiry in YEARS. Weekly options are around 0.019. */
    years: number;
    /** Risk-free rate as a decimal, e.g. 0.065. */
    rate: number;
    /** Volatility as a decimal, e.g. 0.14 for 14%. */
    vol: number;
    /** Continuous dividend yield. Zero for an index unless you are adjusting for it. */
    yield?: number;
    type: OptionType;
}

export interface Greeks {
    price: number;
    /** Change in option price per 1.0 move in spot. */
    delta: number;
    /** Change in delta per 1.0 move in spot. */
    gamma: number;
    /** Change in price per CALENDAR DAY of decay. Negative for a long option. */
    theta: number;
    /** Change in price per 1 PERCENTAGE POINT of implied volatility. */
    vega: number;
    /** Change in price per 1 percentage point of interest rate. */
    rho: number;
}

/* ------------------------------------------------------------------ normal dist */

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** Standard normal probability density. */
export function pdf(x: number): number {
    return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

/**
 * Standard normal cumulative distribution.
 *
 * Zelen & Severo (A&S 26.2.17). Absolute error is bounded by about 7.5e-8, which is
 * comfortably beyond what an option price quoted in paise can resolve — but it is an
 * APPROXIMATION, so `cdf(0)` is 0.5 to nine places rather than exactly 0.5. Tests
 * assert to that accuracy rather than to machine precision, because claiming more would
 * be claiming something this function does not provide.
 */
export function cdf(x: number): number {
    if (!Number.isFinite(x)) return x > 0 ? 1 : 0;
    const sign = x < 0 ? -1 : 1;
    const z = Math.abs(x) / Math.SQRT2;

    const t = 1 / (1 + 0.3275911 * z);
    const y =
        1 -
        ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
            t *
            Math.exp(-z * z);

    return 0.5 * (1 + sign * y);
}

/* ---------------------------------------------------------------------- pricing */

/** Value at expiry — what the option is worth if it settled right now. */
export function intrinsic(spot: number, strike: number, type: OptionType): number {
    return type === 'CE' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
}

function d1d2(i: PriceInputs): { d1: number; d2: number; sqrtT: number } {
    const q = i.yield ?? 0;
    const sqrtT = Math.sqrt(i.years);
    const d1 = (Math.log(i.spot / i.strike) + (i.rate - q + (i.vol * i.vol) / 2) * i.years) / (i.vol * sqrtT);
    return { d1, d2: d1 - i.vol * sqrtT, sqrtT };
}

/**
 * Black-Scholes price.
 *
 * At or past expiry, and at zero volatility, the model degenerates — both cases collapse
 * to intrinsic value, which is the right answer rather than a guard against NaN.
 */
export function price(i: PriceInputs): number {
    if (!(i.spot > 0) || !(i.strike > 0)) return 0;
    if (i.years <= 0 || i.vol <= 0) return intrinsic(i.spot, i.strike, i.type);

    const q = i.yield ?? 0;
    const { d1, d2 } = d1d2(i);
    const dfQ = Math.exp(-q * i.years);
    const dfR = Math.exp(-i.rate * i.years);

    return i.type === 'CE'
        ? i.spot * dfQ * cdf(d1) - i.strike * dfR * cdf(d2)
        : i.strike * dfR * cdf(-d2) - i.spot * dfQ * cdf(-d1);
}

/**
 * Price and all five sensitivities.
 *
 * Theta is per CALENDAR DAY and vega and rho are per PERCENTAGE POINT, because those are
 * the units every options screen quotes. The raw partial derivatives are per year and
 * per 1.0 of volatility, and showing a vega of 12 when the trader expects 0.12 is the
 * kind of unit error that survives review because both numbers look plausible.
 */
export function greeks(i: PriceInputs): Greeks {
    const p = price(i);

    if (i.years <= 0 || i.vol <= 0 || !(i.spot > 0) || !(i.strike > 0)) {
        // Past expiry the position is a cash amount: it moves 1:1 with spot if in the
        // money and not at all if out, and no other sensitivity remains.
        const itm = intrinsic(i.spot, i.strike, i.type) > 0;
        return {
            price: p,
            delta: itm ? (i.type === 'CE' ? 1 : -1) : 0,
            gamma: 0,
            theta: 0,
            vega: 0,
            rho: 0,
        };
    }

    const q = i.yield ?? 0;
    const { d1, d2, sqrtT } = d1d2(i);
    const dfQ = Math.exp(-q * i.years);
    const dfR = Math.exp(-i.rate * i.years);
    const nd1 = pdf(d1);

    const delta = i.type === 'CE' ? dfQ * cdf(d1) : -dfQ * cdf(-d1);
    const gamma = (dfQ * nd1) / (i.spot * i.vol * sqrtT);
    const vegaPerUnit = i.spot * dfQ * nd1 * sqrtT;

    const decay = -(i.spot * dfQ * nd1 * i.vol) / (2 * sqrtT);
    const thetaPerYear =
        i.type === 'CE'
            ? decay - i.rate * i.strike * dfR * cdf(d2) + q * i.spot * dfQ * cdf(d1)
            : decay + i.rate * i.strike * dfR * cdf(-d2) - q * i.spot * dfQ * cdf(-d1);

    const rhoPerUnit = i.type === 'CE' ? i.strike * i.years * dfR * cdf(d2) : -i.strike * i.years * dfR * cdf(-d2);

    return {
        price: p,
        delta,
        gamma,
        theta: thetaPerYear / 365,
        vega: vegaPerUnit / 100,
        rho: rhoPerUnit / 100,
    };
}

/* ------------------------------------------------------------------ IV solving */

export const MIN_VOL = 0.001;
export const MAX_VOL = 5;

/**
 * Below this vega, an option's price does not identify its volatility.
 *
 * Scaled by spot, because vega scales with spot: 1e-6 of spot is around 0.02 on NIFTY.
 * Far from the money the price is essentially all intrinsic value and moving volatility
 * by ten points changes it by less than a paisa — so any IV "recovered" there is an
 * artefact of where the solver happened to stop, not a measurement.
 *
 * This is why NSE itself reports 0 IV on deep-ITM and illiquid strikes. Arriving at the
 * same conclusion independently is the correct outcome, and returning null says
 * "unmeasurable here" where a number would claim a reading that does not exist.
 */
const VEGA_IDENTIFIABLE = 1e-6;

/** No-arbitrage bounds. A price outside these cannot be produced by any volatility. */
function bounds(i: Omit<PriceInputs, 'vol'>): { lo: number; hi: number } {
    const q = i.yield ?? 0;
    const dfQ = Math.exp(-q * i.years);
    const dfR = Math.exp(-i.rate * i.years);
    return i.type === 'CE'
        ? { lo: Math.max(0, i.spot * dfQ - i.strike * dfR), hi: i.spot * dfQ }
        : { lo: Math.max(0, i.strike * dfR - i.spot * dfQ), hi: i.strike * dfR };
}

/**
 * Implied volatility: the volatility that reproduces an observed market price.
 *
 * Newton-Raphson, converging in a handful of iterations near the money, with a bisection
 * fallback. The fallback is not defensive padding — Newton genuinely diverges in the
 * wings, where vega approaches zero and a division by it throws the estimate a long way
 * from any sensible root.
 *
 * RETURNS NULL in two distinct situations, and both matter on a real chain:
 *
 *   - No volatility reproduces the price. A stale last-traded price on an illiquid
 *     strike can sit below intrinsic value, and nothing in the model produces that.
 *   - Volatility is not IDENTIFIABLE from the price, because vega is negligible. Deep
 *     in or out of the money the price is all intrinsic and barely moves with vol.
 *
 * In both cases a plausible-looking number would be indistinguishable from a real
 * reading, which is exactly the failure this codebase exists to avoid.
 */
export function impliedVol(market: number, i: Omit<PriceInputs, 'vol'>): number | null {
    if (!Number.isFinite(market) || market <= 0) return null;
    if (!(i.spot > 0) || !(i.strike > 0) || i.years <= 0) return null;

    const { lo, hi } = bounds(i);
    // A tiny tolerance on the lower bound: a price exactly AT intrinsic implies zero
    // volatility, which is a boundary rather than an error, but anything below it is
    // outside the model entirely.
    if (market < lo - 1e-9 || market > hi + 1e-9) return null;

    const at = (vol: number) => price({ ...i, vol });

    let vol = 0.2;
    for (let n = 0; n < 40; n++) {
        const diff = at(vol) - market;
        if (Math.abs(diff) < 1e-8) return identifiable(clampVol(vol), i);

        const v = greeks({ ...i, vol }).vega * 100; // back to per-1.0 units
        if (!Number.isFinite(v) || Math.abs(v) < 1e-10) break;

        const next = vol - diff / v;
        if (!Number.isFinite(next) || next <= MIN_VOL || next >= MAX_VOL) break;
        vol = next;
    }

    // Bisection over the whole admissible range. Price is monotonically increasing in
    // volatility, so a sign change brackets the unique root.
    let a = MIN_VOL;
    let b = MAX_VOL;
    if (at(a) > market || at(b) < market) return null;

    for (let n = 0; n < 200; n++) {
        const mid = (a + b) / 2;
        const diff = at(mid) - market;
        if (Math.abs(diff) < 1e-8 || b - a < 1e-9) return identifiable(clampVol(mid), i);
        if (diff < 0) a = mid;
        else b = mid;
    }
    return identifiable(clampVol((a + b) / 2), i);
}

const clampVol = (v: number) => (v >= MIN_VOL && v <= MAX_VOL ? v : null);

/**
 * Accept a solution only where the price could actually have identified it.
 *
 * Checked AT THE SOLUTION rather than at a fixed probe volatility, because
 * identifiability is a property of where the root sits. A deep-ITM strike is
 * unrecoverable at 5% volatility and perfectly recoverable at 60%; probing at a fixed
 * 20% gets both of those wrong, in opposite directions.
 */
function identifiable(vol: number | null, i: Omit<PriceInputs, 'vol'>): number | null {
    if (vol === null) return null;
    const vega = greeks({ ...i, vol }).vega * 100; // back to per-1.0 units
    return Number.isFinite(vega) && vega >= i.spot * VEGA_IDENTIFIABLE ? vol : null;
}

/* --------------------------------------------------------------------- helpers */

const MS_PER_YEAR = 365 * 24 * 3_600_000;

/** Years between two instants, floored at zero. Expiry in the past is not negative time. */
export function yearsBetween(nowMs: number, expiryMs: number): number {
    return Math.max(0, (expiryMs - nowMs) / MS_PER_YEAR);
}

/**
 * Default risk-free rate, used when a chain does not carry one.
 *
 * Deliberately a stated assumption rather than a live figure: this app has no yield-curve
 * feed, and an approximate rate moves an option price far less than an approximate
 * volatility does. Verify against the current 91-day T-bill if precision matters.
 */
export const DEFAULT_RATE = 0.065;
export const RATE_VERIFIED_ON = '2026-08';
