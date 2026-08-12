import { describe, it, expect } from 'vitest';
import { realisedVol, nearestStrike, syntheticChainAt, SYNTHETIC_WARNING } from './syntheticChain';
import { compactChain, istDate } from './snapshot';
import { series, rising, flat } from '@/test/candles';
import type { OptionChain } from '@/lib/marketData/providers/nseOptionChain';

// The synthetic chain and the snapshot compactor.
//
// The thing worth testing hardest here is what these REFUSE to do. A synthetic chain
// priced at an invented default volatility would look identical to a real one, and a
// stored snapshot with no underlying level would read as a valid day that produces
// nothing. Both must decline rather than degrade.

describe('realised volatility', () => {
    it('measures a noisy series and is higher than a calm one', () => {
        const calm = series(Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 0.5));
        const wild = series(Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 12));
        const a = realisedVol(calm, 59)!;
        const b = realisedVol(wild, 59)!;
        expect(a).toBeGreaterThan(0);
        expect(b).toBeGreaterThan(a);
    });

    it('returns null rather than a number from too little history', () => {
        // A volatility estimated from four bars is noise, and pricing a whole chain off
        // it would give synthetic data a precision it has not earned.
        const bars = rising(6);
        expect(realisedVol(bars, 5)).toBeNull();
    });

    it('returns null on a perfectly flat series instead of zero', () => {
        // Zero volatility prices every option at intrinsic, which would silently make a
        // whole backtest trade at zero premium.
        expect(realisedVol(flat(60, 100, 0), 59)).toBeNull();
    });
});

describe('synthetic chain', () => {
    const bars = series(Array.from({ length: 120 }, (_, i) => 24000 + Math.sin(i / 4) * 250 + i * 3));

    it('builds strikes around the money at the listed spacing', () => {
        const chain = syntheticChainAt(bars, 100, 110, { step: 50, width: 5 })!;
        expect(chain.synthetic).toBe(true);
        expect(chain.strikes).toHaveLength(11);

        const strikes = chain.strikes.map((s) => s.strike);
        expect(strikes.every((k) => k % 50 === 0)).toBe(true);
        // Centred on the money.
        const atm = strikes[Math.floor(strikes.length / 2)];
        expect(Math.abs(atm - chain.spot)).toBeLessThanOrEqual(25);
    });

    it('prices calls falling and puts rising as the strike goes up', () => {
        const chain = syntheticChainAt(bars, 100, 110, { step: 50, width: 6 })!;
        for (let i = 1; i < chain.strikes.length; i++) {
            expect(chain.strikes[i].call).toBeLessThanOrEqual(chain.strikes[i - 1].call + 1e-9);
            expect(chain.strikes[i].put).toBeGreaterThanOrEqual(chain.strikes[i - 1].put - 1e-9);
        }
    });

    it('decays premium as expiry approaches', () => {
        const far = syntheticChainAt(bars, 60, 110, { step: 50, width: 2 })!;
        const near = syntheticChainAt(bars, 105, 110, { step: 50, width: 2 })!;
        expect(near.years).toBeLessThan(far.years);
    });

    it('REFUSES to price without an estimable volatility', () => {
        // The alternative — substituting a default — produces a chain indistinguishable
        // from a real one that silently decides every result computed from it.
        expect(syntheticChainAt(flat(60, 100, 0), 59, 70, { step: 50 })).toBeNull();
        expect(syntheticChainAt(rising(6), 5, 10, { step: 50 })).toBeNull();
    });

    it('prices AT expiry as pure intrinsic value', () => {
        // Not a rejection: this is the chain a structure settles against, and without it
        // nothing could ever reach expiry. Every option is worth max(0, spot − strike).
        const atExpiry = syntheticChainAt(bars, 100, 100, { step: 50, width: 3 })!;
        expect(atExpiry.years).toBe(0);
        for (const s of atExpiry.strikes) {
            expect(s.call).toBeCloseTo(Math.max(0, atExpiry.spot - s.strike), 6);
            expect(s.put).toBeCloseTo(Math.max(0, s.strike - atExpiry.spot), 6);
        }
    });

    it('refuses an expiry in the past', () => {
        expect(syntheticChainAt(bars, 100, 90, { step: 50 })).toBeNull();
    });

    it('carries a warning that names the specific way it misleads', () => {
        // "Synthetic" alone invites reading the P&L anyway. The warning has to say WHY
        // the number is wrong, not merely that it is modelled.
        expect(SYNTHETIC_WARNING).toMatch(/implied and realised volatility are equal/i);
        expect(SYNTHETIC_WARNING).toMatch(/short-volatility/i);
    });

    it('rounds to the nearest listed strike', () => {
        expect(nearestStrike(24471, 50)).toBe(24450);
        expect(nearestStrike(24480, 50)).toBe(24500);
        expect(nearestStrike(52040, 100)).toBe(52000);
    });
});

describe('snapshot compaction', () => {
    const chain = (over: Partial<OptionChain> = {}): OptionChain => ({
        symbol: 'NIFTY',
        expiry: '18-Aug-2026',
        underlying: 24471,
        quotedAt: '11-Aug-2026 15:40:00',
        strikes: [
            { strike: 24400, call: { lastPrice: 120, impliedVolatility: 11.2, openInterest: 9000, changeInOpenInterest: 10, bid: 119, ask: 121 }, put: { lastPrice: 40, impliedVolatility: null, openInterest: 500, changeInOpenInterest: 0, bid: null, ask: null } },
            { strike: 24450, call: { lastPrice: null, impliedVolatility: null, openInterest: null, changeInOpenInterest: null, bid: null, ask: null }, put: null },
        ],
        ...over,
    });

    it('keeps what a backtester needs and drops the rest', () => {
        const out = compactChain(chain());
        expect(out).toHaveLength(1); // the untraded strike is dropped entirely
        expect(out[0]).toEqual({
            k: 24400,
            // The touch is kept so a backtest can charge a real spread rather than mid.
            ce: { p: 120, iv: 11.2, oi: 9000, b: 119, a: 121 },
            // Absent fields are OMITTED, not stored as null — the put had no quotes.
            pe: { p: 40, oi: 500 },
        });
    });

    it('omits an implied volatility NSE did not report, rather than storing zero', () => {
        const out = compactChain(chain());
        expect(out[0].pe).not.toHaveProperty('iv');
        expect(out[0].ce).toHaveProperty('iv');
    });

    it('drops strikes with no traded price on either side', () => {
        const empty = compactChain(chain({ strikes: [{ strike: 1, call: null, put: null }] }));
        expect(empty).toHaveLength(0);
    });
});

describe('IST trading date', () => {
    it('uses the Indian trading day, not UTC', () => {
        // 20:00 UTC is already the next day in India. Storing the UTC date would file an
        // evening capture under the wrong trading session.
        expect(istDate(Date.UTC(2026, 7, 11, 20, 0, 0))).toBe('2026-08-12');
        expect(istDate(Date.UTC(2026, 7, 11, 10, 0, 0))).toBe('2026-08-11');
    });
});
