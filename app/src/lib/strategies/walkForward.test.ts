import { describe, it, expect } from 'vitest';
import { runWalkForward, optimise, expandGrid, returnOverDrawdown, MAX_COMBINATIONS } from './walkForward';
import { runStrategyBacktest } from './backtest';
import { HOLD, num, type Action, type Strategy, type StrategyContext } from './types';
import type { Candle } from '@/lib/mockData';

const bar = (time: number, o: number, h: number, l: number, c: number): Candle => ({
    time, open: o, high: h, low: l, close: c, volume: 1000,
});
const series = (closes: number[], spread = 0.5): Candle[] =>
    closes.map((c, i) => bar(1_700_000_000 + i * 86_400, c, c + spread, c - spread, c));

/** A noisy but generally rising series, long enough to split into folds. */
const wavy = (n: number) =>
    series(Array.from({ length: n }, (_, i) => 100 + i * 0.25 + Math.sin(i / 6) * 8 + Math.sin(i / 2.3) * 3));

function testStrategy(onBar: (ctx: StrategyContext) => Action, over: Partial<Strategy> = {}): Strategy {
    return {
        id: `wf-${over.id ?? 'x'}`,
        name: 'WF test',
        family: 'trend',
        markets: ['us'],
        shape: 'single',
        params: [
            { key: 'fast', label: 'Fast', help: '', type: 'int', min: 2, max: 50, default: 5 },
            { key: 'slow', label: 'Slow', help: '', type: 'int', min: 3, max: 100, default: 20 },
        ],
        warmup: (p) => num(p, 'slow', 20) + 2,
        onBar,
        normalise: (p) => ({ ...p, fast: Math.min(num(p, 'fast'), num(p, 'slow') - 1) }),
        explain: { idea: '', entry: '', exit: '', whenItFails: '' },
        ...over,
    };
}

const maCross = testStrategy((ctx) => {
    const fast = ctx.ind.sma(num(ctx.params, 'fast', 5));
    const slow = ctx.ind.sma(num(ctx.params, 'slow', 20));
    if (fast == null || slow == null) return HOLD;
    if (!ctx.position && fast > slow) {
        return { kind: 'enter', side: 'buy', sizing: { kind: 'equityPct', pct: 90 }, reason: 'cross up' };
    }
    if (ctx.position && fast < slow) return { kind: 'exit', reason: 'cross down' };
    return HOLD;
}, { id: 'cross' });

const base = {
    strategy: maCross,
    symbol: 'AAPL',
    market: 'us' as const,
    barSeconds: 86_400,
    startingCapital: 100_000,
};

describe('expandGrid', () => {
    it('produces the cartesian product in a stable order', () => {
        const g = expandGrid({ a: [1, 2], b: ['x', 'y'] });
        expect(g).toHaveLength(4);
        expect(g[0]).toEqual({ a: 1, b: 'x' });
        expect(expandGrid({ a: [1, 2], b: ['x', 'y'] })).toEqual(g); // deterministic
    });

    it('handles an empty or malformed grid without throwing', () => {
        expect(expandGrid({})).toEqual([{}]);
        expect(expandGrid({ a: [] })).toEqual([{}]);
    });
});

describe('optimise', () => {
    it('returns the best-scoring combination and reports how many it tried', () => {
        const r = optimise({ ...base, bars: wavy(220) }, { fast: [3, 5, 8], slow: [20, 30] });
        expect(r.tried).toBe(6);
        expect([3, 5, 8]).toContain(r.params.fast);
        expect(r.result).not.toBeNull();
    });

    it('scores a no-trade result as worthless, not as flawless', () => {
        // Zero trades means zero drawdown, which a naive return/drawdown objective would
        // rank above every strategy that actually took risk.
        const never = testStrategy(() => HOLD, { id: 'never' });
        const res = runStrategyBacktest({ ...base, strategy: never, bars: wavy(220) });
        expect(res.trades).toEqual([]);
        expect(returnOverDrawdown(res)).toBe(Number.NEGATIVE_INFINITY);
    });

    it('returns no winner at all when nothing in the grid ever traded', () => {
        const never = testStrategy(() => HOLD, { id: 'never2' });
        const r = optimise({ ...base, strategy: never, bars: wavy(220) }, { fast: [3, 5] });
        expect(r.result).toBeNull();
        expect(r.score).toBe(Number.NEGATIVE_INFINITY);
    });

    it('caps the search rather than running an unbounded grid', () => {
        const huge: Record<string, number[]> = {
            fast: Array.from({ length: 10 }, (_, i) => i + 2),
            slow: Array.from({ length: 10 }, (_, i) => i + 30),
        };
        const r = optimise({ ...base, bars: wavy(160) }, huge, { maxCombinations: 7 });
        expect(r.tried).toBe(7);
        expect(MAX_COMBINATIONS).toBeGreaterThan(7);   // the default is not what we forced
    });
});

describe('runWalkForward', () => {
    const grid = { fast: [3, 8], slow: [20, 30] };

    it('reports in-sample and out-of-sample separately', () => {
        const r = runWalkForward({ ...base, bars: wavy(400), grid, folds: 4 });
        expect(r.folds.length).toBeGreaterThanOrEqual(3);
        expect(Number.isFinite(r.inSampleNetPct)).toBe(true);
        expect(Number.isFinite(r.outOfSampleNetPct)).toBe(true);
        expect(r.degradation).toBeCloseTo(r.inSampleNetPct - r.outOfSampleNetPct, 8);
    });

    it('never lets a fold optimise on the data it is then tested against', () => {
        const r = runWalkForward({ ...base, bars: wavy(400), grid, folds: 4 });
        for (const f of r.folds) {
            expect(f.trainTo).toBeLessThanOrEqual(f.testFrom);
            expect(f.testFrom).toBeLessThan(f.testTo);
        }
    });

    it('collects out-of-sample trades only', () => {
        const r = runWalkForward({ ...base, bars: wavy(400), grid, folds: 4 });
        const fromFolds = r.folds.reduce((n, f) => n + f.outOfSampleTrades.length, 0);
        expect(r.outOfSampleTrades).toHaveLength(fromFolds);
    });

    it('flags unstable parameters when the winner changes between folds', () => {
        const r = runWalkForward({ ...base, bars: wavy(400), grid, folds: 4 });
        if (r.unstable) {
            expect(r.warnings.some((w) => /changed between folds/i.test(w))).toBe(true);
        } else {
            const first = JSON.stringify(r.folds[0].bestParams);
            for (const f of r.folds) expect(JSON.stringify(f.bestParams)).toBe(first);
        }
    });

    it('refuses to run rather than produce a meaningless result from short windows', () => {
        const r = runWalkForward({ ...base, bars: wavy(80), grid, folds: 8 });
        expect(r.folds).toEqual([]);
        expect(r.warnings.some((w) => /not run/i.test(w))).toBe(true);
    });

    it('warns when the grid is larger than it will actually evaluate', () => {
        const r = runWalkForward({ ...base, bars: wavy(400), grid, folds: 2, maxCombinations: 2 });
        expect(r.warnings.some((w) => /only the first/i.test(w))).toBe(true);
    });

    it('produces no NaN anywhere, even on a flat series', () => {
        const r = runWalkForward({ ...base, bars: series(Array.from({ length: 600 }, () => 100)), grid, folds: 3 });
        expect(Number.isFinite(r.inSampleNetPct)).toBe(true);
        expect(Number.isFinite(r.outOfSampleNetPct)).toBe(true);
        expect(Number.isFinite(r.degradation)).toBe(true);
    });
});
