import { describe, it, expect } from 'vitest';
import { runStrategyBacktest } from '../backtest';
import { defaultParams, sanitiseParams, type Params, type Strategy } from '../types';
import { allStrategies, strategyById } from './index';
import { maCrossover, donchianBreakout, atrTrailingTrend, macdTrend } from './trend';
import { bollingerRsi, rsi2, zscoreReversion, vwapReversion } from './meanReversion';
import { buyAndHold } from './benchmark';
import { flat, rising, falling, oscillating, choppy, upThenDown, downThenUp, decliningNoisy, series } from '@/test/candles';
import { harnessFor } from './harness';
import type { Candle } from '@/lib/mockData';

const base = { symbol: 'AAPL', market: 'us' as const, barSeconds: 86_400, startingCapital: 100_000 };
const run = (strategy: Strategy, bars: Candle[], params: Params = {}) =>
    runStrategyBacktest({ ...base, strategy, bars, params });

/** Close paths, as plain numbers, so the harness can stamp them into the right time shape. */
const paths = {
    flat: (n: number) => Array.from({ length: n }, () => 100),
    rising: (n: number) => Array.from({ length: n }, (_, i) => 100 + i * 0.5),
    falling: (n: number) => Array.from({ length: n }, (_, i) => Math.max(5, 400 - i * 0.8)),
    oscillating: (n: number) => Array.from({ length: n }, (_, i) => 100 + Math.sin((i / 25) * Math.PI * 2) * 12),
    choppy: (n: number) => Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 1.7) * 3 + Math.sin(i / 4.3) * 1.8),
    upThenDown: (n: number) => Array.from({ length: n }, (_, i) => (i < n / 2 ? 100 + i * 1.5 : Math.max(5, 100 + (n / 2) * 1.5 - (i - n / 2) * 1.5))),
    decliningNoisy: (n: number) => Array.from({ length: n }, (_, i) => Math.max(5, 400 - i * 1.2 + Math.sin(i / 5) * 9)),
};

/**
 * Run a strategy against a close path, in whatever bar shape and with whatever extra
 * series or events that strategy actually needs.
 */
const runPath = (strategy: Strategy, closes: number[], params: Params = {}) => {
    const h = harnessFor(strategy, closes);
    return runStrategyBacktest({ ...h, strategy, params, startingCapital: 100_000 });
};

/** A world with no price movement AND no scheduled events — genuinely no information. */
const runQuiet = (strategy: Strategy, closes: number[]) => {
    const h = harnessFor(strategy, closes, { quiet: true });
    return runStrategyBacktest({ ...h, strategy, startingCapital: 100_000 });
};

/* ------------------------------------------------- invariants every strategy must hold */

describe('every registered strategy', () => {
    const all = allStrategies();

    it('is registered and reachable by id', () => {
        expect(all.length).toBeGreaterThan(0);
        for (const s of all) expect(strategyById(s.id)).toBe(s);
    });

    it('has unique ids', () => {
        const ids = all.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('states its caveats where the engine cannot fully express the strategy', () => {
        // Pairs, spreads, grids and cross-sectional ranking are all reduced by the
        // one-position engine. Each must say so rather than let the result be read as
        // the real thing.
        for (const s of all.filter((x) => x.shape !== 'single' || x.family === 'range' || x.signalOnly)) {
            expect(s.caveats?.length, `${s.id} must declare its limits`).toBeGreaterThan(0);
        }
    });

    it('declares a complete explain block with an honest failure mode', () => {
        for (const s of all) {
            expect(s.explain.idea.length, s.id).toBeGreaterThan(80);
            expect(s.explain.entry.length, s.id).toBeGreaterThan(20);
            expect(s.explain.exit.length, s.id).toBeGreaterThan(20);
            // The section that says where it loses money is the one most likely to be
            // skipped, so it is held to the same bar as the section that sells it.
            expect(s.explain.whenItFails.length, s.id).toBeGreaterThan(80);
        }
    });

    it('gives every parameter help text a beginner could act on', () => {
        for (const s of all) {
            for (const p of s.params) {
                expect(p.help.length, `${s.id}.${p.key}`).toBeGreaterThan(20);
                expect(p.label.length, `${s.id}.${p.key}`).toBeGreaterThan(0);
                if (p.type !== 'choice') expect(typeof p.default, `${s.id}.${p.key}`).toBe('number');
            }
        }
    });

    it('takes NO trades on a perfectly flat series', () => {
        // A strategy that trades on no information at all is reacting to its own
        // rounding, and every signal it produces later is suspect.
        for (const s of all) {
            if (s.id === buyAndHold.id) continue;  // buying is its entire definition
            expect(runQuiet(s, paths.flat(400)).trades, s.id).toEqual([]);
        }
    });

    it('never opens a position from a signal-only strategy', () => {
        // These exist to make something readable, not tradeable. One that quietly opened
        // a position would be describing a trade the engine cannot actually place.
        for (const s of all.filter((x) => x.signalOnly)) {
            for (const path of Object.values(paths)) {
                expect(runPath(s, path(300)).trades, s.id).toEqual([]);
            }
        }
    });

    it('never opens a position before its own warm-up has elapsed', () => {
        for (const s of all) {
            const warmup = s.warmup(defaultParams(s));
            for (const path of [paths.rising, paths.falling, paths.oscillating]) {
                for (const t of runPath(s, path(400)).trades) {
                    expect(t.entryIndex, `${s.id} traded at bar ${t.entryIndex} with warmup ${warmup}`)
                        .toBeGreaterThan(warmup);
                }
            }
        }
    });

    it('actually trades in at least one regime — an inert strategy is not a strategy', () => {
        // The companion to "losses are reachable". Without this, a strategy that never
        // fires would sail through every other invariant here.
        for (const s of all.filter((x) => !x.signalOnly)) {
            const traded = Object.values(paths).some((path) => runPath(s, path(400)).trades.length > 0);
            expect(traded, `${s.id} never traded in ANY regime`).toBe(true);
        }
    });

    it('can lose money — losses must be reachable', () => {
        // The single most important test here. A strategy that cannot lose in ANY of
        // these regimes is not a strategy, it is a bug.
        for (const s of all.filter((x) => !x.signalOnly)) {
            // Each path is stamped into the bar shape this strategy needs, with any
            // required peer series and events supplied — otherwise a strategy that
            // cannot trade at all would pass by never losing anything.
            const anyLoss = Object.values(paths).some((path) => runPath(s, path(400)).metrics.netPct < 0);
            expect(anyLoss, `${s.id} never lost money in any adverse regime`).toBe(true);
        }
    });

    it('produces no NaN or Infinity in any metric, in any regime', () => {
        for (const s of all) {
            for (const path of [...Object.values(paths).map((f) => f(150)), paths.rising(4)]) {
                const r = runPath(s, path);
                for (const [k, v] of Object.entries(r.metrics)) {
                    if (typeof v === 'number') expect(Number.isFinite(v), `${s.id} ${k}`).toBe(true);
                }
            }
        }
    });

    it('survives sanitised extreme parameters without throwing', () => {
        for (const s of all) {
            const extreme: Params = {};
            for (const p of s.params) extreme[p.key] = p.type === 'choice' ? 'nonsense' : Number.NaN;
            expect(() => runPath(s, paths.oscillating(400), sanitiseParams(s, extreme)), s.id).not.toThrow();
        }
    });
});

/* ------------------------------------------------------------------ benchmark */

describe('buy and hold', () => {
    it('holds one position for the whole period', () => {
        const r = run(buyAndHold, rising(200));
        expect(r.trades).toHaveLength(1);
        expect(r.trades[0].reason).toBe('forced');
        expect(r.metrics.exposure).toBeGreaterThan(0.95);
    });

    it('tracks the instrument, so it lands near the engine benchmark', () => {
        const r = run(buyAndHold, rising(200));
        expect(r.metrics.netPct).toBeCloseTo(r.metrics.benchmarkPct, 0);
    });
});

/* ---------------------------------------------------------------------- trend */

describe('trend strategies', () => {
    it('maCrossover buys a trend CHANGE and profits from the move that follows', () => {
        // Deliberately not a monotonic ramp: the averages have to actually cross.
        const r = run(maCrossover, downThenUp(60, 240, 2), { fast: 10, slow: 30, sizePct: 90 });
        expect(r.trades.length).toBeGreaterThan(0);
        expect(r.trades[0].side).toBe('long');
        expect(r.metrics.netPct).toBeGreaterThan(0);
    });

    it('maCrossover is chopped up by an oscillating market', () => {
        const trend = run(maCrossover, downThenUp(60, 240, 2), { fast: 10, slow: 30 });
        const chop = run(maCrossover, oscillating(300, 10, 25), { fast: 10, slow: 30 });
        expect(chop.metrics.netPct).toBeLessThan(trend.metrics.netPct);
    });

    it('maCrossover keeps fast strictly below slow however it is configured', () => {
        expect(sanitiseParams(maCrossover, { fast: 90, slow: 20 }).fast).toBeLessThan(20);
    });

    it('maCrossover can short when told to', () => {
        const r = run(maCrossover, upThenDown(60, 240, 2), { fast: 10, slow: 30, direction: 'short' });
        expect(r.trades.length).toBeGreaterThan(0);
        expect(r.trades.every((t) => t.side === 'short')).toBe(true);
    });

    it('donchianBreakout needs a genuinely new extreme, not the current bar', () => {
        // The channel excludes the current bar; if it did not, every new high would be a
        // breakout of itself and this would open and close constantly.
        const r = run(donchianBreakout, rising(300), { entryLookback: 20, exitLookback: 10 });
        expect(r.trades.length).toBeLessThan(10);
        expect(r.metrics.netPct).toBeGreaterThan(0);
    });

    it('donchianBreakout keeps the exit channel shorter than the entry channel', () => {
        // Otherwise the exit condition is already true on the bar you enter.
        const p = sanitiseParams(donchianBreakout, { entryLookback: 20, exitLookback: 50 });
        expect(Number(p.exitLookback)).toBeLessThan(Number(p.entryLookback));
    });

    it('atrTrailingTrend ratchets its stop and never loosens it', () => {
        const r = run(atrTrailingTrend, rising(300), { breakout: 20, atrPeriod: 14, atrMult: 2 });
        expect(r.trades.length).toBeGreaterThan(0);
        // A trailing stop that follows a rising market must eventually exit ABOVE entry.
        const winners = r.trades.filter((t) => t.reason === 'stop' && t.side === 'long');
        if (winners.length) expect(Math.max(...winners.map((t) => t.exitPrice - t.entryPrice))).toBeGreaterThan(0);
    });

    it('macdTrend suppresses weak crossings when a strength floor is set', () => {
        const loose = run(macdTrend, choppy(400), { minHist: 0 });
        const strict = run(macdTrend, choppy(400), { minHist: 1 });
        expect(strict.trades.length).toBeLessThanOrEqual(loose.trades.length);
    });
});

/* ------------------------------------------------------------- mean reversion */

describe('mean reversion strategies', () => {
    it('bollingerRsi profits in an oscillating market when the stop clears the swing', () => {
        // The stop has to sit outside the amplitude it is fading. A 4% stop inside a
        // +/-14% swing is hit on the way to the trough every time — which is a real
        // lesson about this strategy, not a quirk of the fixture.
        const r = run(bollingerRsi, oscillating(600, 14, 30), {
            period: 20, mult: 1.5, oversold: 35, overbought: 65, stopPct: 20, sizePct: 90,
        });
        expect(r.trades.length).toBeGreaterThan(0);
        expect(r.metrics.netPct).toBeGreaterThan(0);
    });

    it('bollingerRsi is stopped out repeatedly when the stop sits inside the swing', () => {
        const tight = run(bollingerRsi, oscillating(600, 14, 30), { period: 20, mult: 1.5, oversold: 35, stopPct: 4, sizePct: 90 });
        const wide = run(bollingerRsi, oscillating(600, 14, 30), { period: 20, mult: 1.5, oversold: 35, stopPct: 20, sizePct: 90 });
        expect(tight.metrics.netPct).toBeLessThan(wide.metrics.netPct);
    });

    it('bollingerRsi loses in a sustained decline — the failure it documents', () => {
        const r = run(bollingerRsi, falling(400, 2), { period: 20, mult: 1.5, oversold: 40, sizePct: 90 });
        expect(r.metrics.netPct).toBeLessThan(0);
    });

    it('bollingerRsi requires BOTH the band and the RSI condition', () => {
        // An impossible RSI threshold must silence it even where bands are pierced.
        const r = run(bollingerRsi, oscillating(400, 14, 30), { oversold: 1, overbought: 99, direction: 'long' });
        expect(r.trades).toEqual([]);
    });

    it('rsi2 refuses to buy below its trend filter', () => {
        // Without the filter this buys every step of a decline.
        const r = run(rsi2, falling(400, 1.5), { trendPeriod: 100 });
        expect(r.trades).toEqual([]);
    });

    it('rsi2 does trade dips inside an uptrend', () => {
        const bars = series(Array.from({ length: 500 }, (_, i) => 100 + i * 0.4 + Math.sin(i / 3) * 6));
        const r = run(rsi2, bars, { trendPeriod: 100, entryLevel: 15 });
        expect(r.trades.length).toBeGreaterThan(0);
        expect(r.trades.every((t) => t.side === 'long')).toBe(true);
    });

    it('zscoreReversion stays silent on a flat window where the score is undefined', () => {
        // Zero deviation makes the z-score undefined, not zero. Treating it as zero
        // would fire an exit — or worse an entry — on every bar of a dead market.
        expect(run(zscoreReversion, flat(300)).trades).toEqual([]);
    });

    it('zscoreReversion trades the extremes of an oscillation', () => {
        const r = run(zscoreReversion, oscillating(600, 12, 30), { period: 30, entryZ: 1.2, exitZ: 0.2, sizePct: 90 });
        expect(r.trades.length).toBeGreaterThan(0);
    });

    it('vwapReversion produces nothing without volume rather than faking VWAP', () => {
        const noVolume = oscillating(300).map((b) => ({ ...b, volume: undefined }));
        expect(run(vwapReversion, noVolume).trades).toEqual([]);
    });

    it('vwapReversion trades once volume is present', () => {
        const r = run(vwapReversion, oscillating(400, 10, 25), { stretchPct: 0.5, sizePct: 90 });
        expect(r.trades.length).toBeGreaterThan(0);
    });
});
