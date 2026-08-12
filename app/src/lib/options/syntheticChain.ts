import type { Candle } from '@/lib/mockData';
import { price as bsPrice, type OptionType } from './greeks';

// A MODELLED option chain, priced from historical spot.
//
// ─────────────────────────────────────────────────────────────────────────────────
//  READ THIS BEFORE USING THE OUTPUT FOR ANYTHING
//
//  These premiums are computed by Black-Scholes from the underlying's own realised
//  volatility. They are NOT historical prices. Nobody paid them, no volatility smile
//  is modelled, no bid-ask spread existed, and every strike is perfectly liquid.
//
//  What this is good for: proving that a strategy's RULES execute — that a condor
//  opens and closes when it should, that expiry settles, that margin is taken. That is
//  a real and useful thing to test, and it is the only thing this can test.
//
//  What it is NOT evidence of: that the strategy made money. A synthetic chain cannot
//  show that, because the single largest driver of options P&L is the difference
//  between implied and realised volatility, and here they are equal by construction.
//  A short-volatility strategy tested against this will look free.
// ─────────────────────────────────────────────────────────────────────────────────

export const SYNTHETIC_WARNING =
    'These premiums are MODELLED from spot with Black-Scholes, not historical. They show whether the rules execute. They are not evidence the strategy made money — implied and realised volatility are equal here by construction, which flatters every short-volatility strategy.';

export interface SyntheticStrike {
    strike: number;
    call: number;
    put: number;
}

export interface SyntheticChain {
    /** Index of the bar this chain was built from. */
    barIndex: number;
    spot: number;
    /** Years to expiry at this bar. */
    years: number;
    /** The volatility used to price every strike. */
    vol: number;
    strikes: SyntheticStrike[];
    synthetic: true;
}

/**
 * Annualised realised volatility from close-to-close log returns.
 *
 * Returns null rather than a number when there is not enough history — a volatility
 * estimated from four bars is noise, and pricing a whole chain off it would give the
 * synthetic data a false precision it has not earned.
 */
export function realisedVol(bars: Candle[], upto: number, lookback = 20, barsPerYear = 252): number | null {
    const from = Math.max(1, upto - lookback + 1);
    if (upto - from < 9) return null;

    const returns: number[] = [];
    for (let i = from; i <= upto; i++) {
        const prev = bars[i - 1]?.close;
        const now = bars[i]?.close;
        if (!(prev > 0) || !(now > 0)) continue;
        returns.push(Math.log(now / prev));
    }
    if (returns.length < 10) return null;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
    const vol = Math.sqrt(variance * barsPerYear);
    return Number.isFinite(vol) && vol > 0 ? vol : null;
}

/** Round a spot level to the nearest strike step, the way an exchange lists them. */
export function nearestStrike(spot: number, step: number): number {
    return Math.round(spot / step) * step;
}

export interface SyntheticOptions {
    /** Strike spacing. NIFTY lists every 50; BANKNIFTY every 100. */
    step: number;
    /** How many strikes either side of the money. */
    width?: number;
    rate?: number;
    lookback?: number;
    barsPerYear?: number;
}

/**
 * Build a chain for one bar, expiring at `expiryBarIndex`.
 *
 * Returns null when volatility cannot be estimated, rather than substituting a default.
 * A chain priced at an invented 20% volatility would look identical to a real one and
 * would silently decide every result computed from it.
 */
export function syntheticChainAt(
    bars: Candle[],
    barIndex: number,
    expiryBarIndex: number,
    opts: SyntheticOptions
): SyntheticChain | null {
    const bar = bars[barIndex];
    if (!bar || !(bar.close > 0) || expiryBarIndex <= barIndex) return null;

    const barsPerYear = opts.barsPerYear ?? 252;
    const vol = realisedVol(bars, barIndex, opts.lookback ?? 20, barsPerYear);
    if (vol === null) return null;

    const spot = bar.close;
    const years = (expiryBarIndex - barIndex) / barsPerYear;
    const atm = nearestStrike(spot, opts.step);
    const width = opts.width ?? 10;
    const rate = opts.rate ?? 0.065;

    const strikes: SyntheticStrike[] = [];
    for (let i = -width; i <= width; i++) {
        const strike = atm + i * opts.step;
        if (strike <= 0) continue;
        const at = (type: OptionType) => bsPrice({ spot, strike, years, rate, vol, type });
        strikes.push({ strike, call: at('CE'), put: at('PE') });
    }

    return { barIndex, spot, years, vol, strikes, synthetic: true };
}
