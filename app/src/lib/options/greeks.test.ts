import { describe, it, expect } from 'vitest';
import { price, greeks, impliedVol, cdf, pdf, intrinsic, yearsBetween, type PriceInputs } from './greeks';

// Reference case used throughout, chosen because it is the most widely published
// Black-Scholes worked example and can be checked against any textbook:
//   S=100  K=100  T=1  r=5%  q=0  vol=20%   →  call 10.4506,  put 5.5735
const BASE: Omit<PriceInputs, 'type' | 'vol'> = { spot: 100, strike: 100, years: 1, rate: 0.05 };
const call = (vol: number, over: Partial<PriceInputs> = {}): PriceInputs => ({ ...BASE, type: 'CE', vol, ...over });
const put = (vol: number, over: Partial<PriceInputs> = {}): PriceInputs => ({ ...BASE, type: 'PE', vol, ...over });

describe('normal distribution', () => {
    it('matches known values of the CDF', () => {
        // Asserted to the accuracy the approximation actually documents (~7.5e-8), not
        // to machine precision. cdf(0) is 0.5000000005, and pretending otherwise would
        // be asserting a guarantee this function does not make.
        expect(cdf(0)).toBeCloseTo(0.5, 8);
        expect(cdf(1)).toBeCloseTo(0.841345, 5);
        expect(cdf(-1)).toBeCloseTo(0.158655, 5);
        expect(cdf(1.96)).toBeCloseTo(0.975002, 5);
        expect(cdf(-3)).toBeCloseTo(0.001350, 5);
    });

    it('is symmetric and bounded', () => {
        for (const x of [-4, -1.5, -0.3, 0, 0.7, 2.2, 5]) {
            expect(cdf(x) + cdf(-x)).toBeCloseTo(1, 6);
            expect(cdf(x)).toBeGreaterThanOrEqual(0);
            expect(cdf(x)).toBeLessThanOrEqual(1);
        }
    });

    it('has a density peaking at zero', () => {
        expect(pdf(0)).toBeCloseTo(0.3989423, 6);
        expect(pdf(1)).toBeCloseTo(0.2419707, 6);
        expect(pdf(2)).toBeLessThan(pdf(1));
    });
});

describe('pricing', () => {
    it('reproduces the published reference values', () => {
        expect(price(call(0.2))).toBeCloseTo(10.4506, 3);
        expect(price(put(0.2))).toBeCloseTo(5.5735, 3);
    });

    it('satisfies put-call parity', () => {
        // C − P = S·e^(−qT) − K·e^(−rT). This is a no-arbitrage identity, not an
        // approximation, so any error here is a real pricing bug.
        for (const vol of [0.1, 0.2, 0.45, 0.9]) {
            for (const strike of [80, 100, 130]) {
                const c = price(call(vol, { strike }));
                const p = price(put(vol, { strike }));
                const expected = 100 - strike * Math.exp(-0.05);
                expect(c - p).toBeCloseTo(expected, 8);
            }
        }
    });

    it('collapses to intrinsic value at expiry', () => {
        expect(price(call(0.2, { years: 0, spot: 120 }))).toBeCloseTo(20, 10);
        expect(price(call(0.2, { years: 0, spot: 80 }))).toBe(0);
        expect(price(put(0.2, { years: 0, spot: 80 }))).toBeCloseTo(20, 10);
        expect(price(put(0.2, { years: 0, spot: 120 }))).toBe(0);
    });

    it('collapses to intrinsic at zero volatility', () => {
        expect(price(call(0, { spot: 130 }))).toBeCloseTo(30, 10);
        expect(price(call(0, { spot: 70 }))).toBe(0);
    });

    it('increases monotonically with volatility', () => {
        // Long options are long vega. A violation here would let a strategy "profit"
        // from a volatility fall while holding a long option.
        let prev = -1;
        for (const vol of [0.05, 0.1, 0.2, 0.4, 0.8, 1.5]) {
            const p = price(call(vol));
            expect(p).toBeGreaterThan(prev);
            prev = p;
        }
    });

    it('never prices below intrinsic or above the underlying', () => {
        for (const spot of [50, 90, 100, 110, 200]) {
            for (const vol of [0.05, 0.3, 1.2]) {
                const c = price(call(vol, { spot }));
                expect(c).toBeGreaterThanOrEqual(intrinsic(spot, 100, 'CE') - 1e-9);
                expect(c).toBeLessThanOrEqual(spot + 1e-9);
            }
        }
    });
});

describe('greeks', () => {
    it('has the right sign and bounds on delta', () => {
        expect(greeks(call(0.2)).delta).toBeGreaterThan(0);
        expect(greeks(put(0.2)).delta).toBeLessThan(0);
        // Deep in the money a call behaves like the stock; deep out, like nothing.
        expect(greeks(call(0.2, { spot: 1000 })).delta).toBeCloseTo(1, 4);
        expect(greeks(call(0.2, { spot: 5 })).delta).toBeCloseTo(0, 4);
        expect(greeks(put(0.2, { spot: 5 })).delta).toBeCloseTo(-1, 3);
    });

    it('satisfies delta parity between call and put', () => {
        const c = greeks(call(0.3)).delta;
        const p = greeks(put(0.3)).delta;
        expect(c - p).toBeCloseTo(1, 8);
    });

    it('peaks gamma at the money and decays either side', () => {
        const atm = greeks(call(0.2, { spot: 100 })).gamma;
        expect(atm).toBeGreaterThan(greeks(call(0.2, { spot: 70 })).gamma);
        expect(atm).toBeGreaterThan(greeks(call(0.2, { spot: 140 })).gamma);
    });

    it('gives identical gamma and vega to a call and a put at the same strike', () => {
        expect(greeks(call(0.25)).gamma).toBeCloseTo(greeks(put(0.25)).gamma, 12);
        expect(greeks(call(0.25)).vega).toBeCloseTo(greeks(put(0.25)).vega, 12);
    });

    it('makes theta negative for a long option — the one certain Greek', () => {
        // Time passes whatever the market does. This is the sensitivity the lesson calls
        // "always working against a buyer", and it must hold at every strike.
        for (const spot of [80, 100, 120]) {
            expect(greeks(call(0.2, { spot })).theta).toBeLessThan(0);
            expect(greeks(put(0.2, { spot, rate: 0 })).theta).toBeLessThan(0);
        }
    });

    it('intensifies gamma and theta together as expiry approaches', () => {
        // The lesson claims these two oppose each other and both spike into expiry.
        // If that were not true, the teaching would be wrong.
        const far = greeks(call(0.2, { years: 0.5 }));
        const near = greeks(call(0.2, { years: 0.01 }));
        expect(near.gamma).toBeGreaterThan(far.gamma);
        expect(Math.abs(near.theta)).toBeGreaterThan(Math.abs(far.theta));
        // Vega does the opposite: it fades as there is less time for vol to matter.
        expect(near.vega).toBeLessThan(far.vega);
    });

    it('quotes vega per percentage point and theta per day', () => {
        // A vega of 39 instead of 0.39 is a unit error that looks plausible on screen.
        // Anchor it: bumping vol by exactly 1 point must move price by about vega.
        const g = greeks(call(0.2));
        const bumped = price(call(0.21));
        expect(bumped - g.price).toBeCloseTo(g.vega, 2);

        // And one day of decay must move price by about theta.
        const oneDayLater = price(call(0.2, { years: 1 - 1 / 365 }));
        expect(oneDayLater - g.price).toBeCloseTo(g.theta, 3);
    });

    it('returns a cash-like position past expiry', () => {
        const g = greeks(call(0.2, { years: 0, spot: 120 }));
        expect(g.delta).toBe(1);
        expect(g.gamma).toBe(0);
        expect(g.theta).toBe(0);
        expect(g.vega).toBe(0);
    });
});

describe('implied volatility', () => {
    it('round-trips a priced option back to its own volatility', () => {
        let solvedCount = 0;
        for (const vol of [0.05, 0.12, 0.2, 0.55, 1.4]) {
            for (const strike of [70, 95, 100, 105, 140]) {
                for (const type of ['CE', 'PE'] as const) {
                    const inputs = { ...BASE, strike, type, vol };
                    const p = price(inputs);
                    const solved = impliedVol(p, { ...BASE, strike, type });

                    if (solved === null) {
                        // Declining is only acceptable where volatility genuinely is not
                        // recoverable — vega negligible. Assert that, so a solver that
                        // quietly gave up on solvable strikes could not pass.
                        expect(greeks(inputs).vega * 100, `${type} K=${strike} vol=${vol} declined`)
                            .toBeLessThan(BASE.spot * 1e-6);
                        continue;
                    }
                    expect(solved, `${type} K=${strike} vol=${vol}`).toBeCloseTo(vol, 4);
                    solvedCount++;
                }
            }
        }
        // Guard against the guard: most of the grid must still be solvable.
        expect(solvedCount).toBeGreaterThan(30);
    });

    it('declines where vega is negligible instead of inventing a reading', () => {
        // Deep ITM at low volatility: the price is essentially all intrinsic value, and
        // moving vol by ten points changes it by less than a paisa. NSE reports 0 IV on
        // exactly these strikes; arriving at the same conclusion is correct.
        const deepItmLowVol = { ...BASE, strike: 70, type: 'CE' as const };
        const p = price({ ...deepItmLowVol, vol: 0.05 });
        expect(impliedVol(p, deepItmLowVol)).toBeNull();
    });

    it('solves in the wings, where Newton alone diverges', () => {
        // Vega approaches zero far from the money, so the derivative step overshoots.
        // This is the case the bisection fallback exists for.
        const deepOtm = { ...BASE, strike: 300, type: 'CE' as const, years: 0.02 };
        const p = price({ ...deepOtm, vol: 0.9 });
        if (p > 1e-8) expect(impliedVol(p, deepOtm)).toBeCloseTo(0.9, 2);

        const deepItm = { ...BASE, strike: 20, type: 'CE' as const };
        expect(impliedVol(price({ ...deepItm, vol: 0.6 }), deepItm)).toBeCloseTo(0.6, 3);
    });

    it('handles the short expiries Indian weeklies actually trade', () => {
        // A weekly is about 0.019 years. If the solver only worked at T=1 it would be
        // useless for the chain this app fetches.
        const weekly = { ...BASE, years: 7 / 365, type: 'CE' as const };
        for (const vol of [0.08, 0.14, 0.35]) {
            const p = price({ ...weekly, vol });
            expect(impliedVol(p, weekly)).toBeCloseTo(vol, 4);
        }
    });

    it('returns NULL rather than a plausible number when no volatility fits', () => {
        // This is the behaviour that matters most on a real chain: a stale last-traded
        // price on an illiquid strike can sit below intrinsic value, and NO volatility
        // reproduces it. Inventing one would be indistinguishable from a real reading.
        const itm = { ...BASE, spot: 150, strike: 100, type: 'CE' as const };
        const belowIntrinsic = 20; // intrinsic is ~50
        expect(impliedVol(belowIntrinsic, itm)).toBeNull();

        // Above the underlying: also impossible for a call.
        expect(impliedVol(200, { ...BASE, type: 'CE' })).toBeNull();

        // Nonsense inputs decline rather than throw.
        expect(impliedVol(0, { ...BASE, type: 'CE' })).toBeNull();
        expect(impliedVol(-5, { ...BASE, type: 'CE' })).toBeNull();
        expect(impliedVol(10, { ...BASE, years: 0, type: 'CE' })).toBeNull();
    });

    it('never returns NaN or Infinity', () => {
        const cases = [1e-8, 0.01, 5, 10.45, 94.9];
        for (const m of cases) {
            const v = impliedVol(m, { ...BASE, type: 'CE' });
            if (v !== null) {
                expect(Number.isFinite(v)).toBe(true);
                expect(v).toBeGreaterThan(0);
            }
        }
    });
});

describe('yearsBetween', () => {
    it('measures forward time and floors an expired contract at zero', () => {
        const now = 1_700_000_000_000;
        expect(yearsBetween(now, now + 365 * 24 * 3_600_000)).toBeCloseTo(1, 9);
        expect(yearsBetween(now, now + 7 * 24 * 3_600_000)).toBeCloseTo(7 / 365, 9);
        // An expiry in the past is zero time, not negative time — negative years would
        // produce a NaN square root and poison every Greek downstream.
        expect(yearsBetween(now, now - 86_400_000)).toBe(0);
    });
});
