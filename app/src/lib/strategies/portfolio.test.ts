import { describe, it, expect } from 'vitest';
import { runPortfolioBacktest, allocate, correlate } from './portfolio';
import { registerAllStrategies, strategyById } from './defs';
import { rising, falling, oscillating, choppy } from '@/test/candles';
import type { PortfolioLeg } from './portfolio';

registerAllStrategies();
const maCross = strategyById('ma-crossover')!;
const buyHold = strategyById('buy-and-hold')!;

const N = 150;

const leg = (symbol: string, bars: ReturnType<typeof rising>, weight?: number): PortfolioLeg =>
    ({ symbol, market: 'us', bars, weight });

const run = (legs: PortfolioLeg[], capital = 400_000) =>
    runPortfolioBacktest({ strategy: buyHold, legs, barSeconds: 86_400, startingCapital: capital });

describe('allocation', () => {
    it('splits equally when no weights are given', () => {
        expect(allocate([leg('A', rising(N)), leg('B', rising(N)), leg('C', rising(N)), leg('D', rising(N))], 400_000))
            .toEqual([100_000, 100_000, 100_000, 100_000]);
    });

    it('honours explicit weights and shares the remainder', () => {
        const out = allocate([leg('A', rising(N), 0.5), leg('B', rising(N)), leg('C', rising(N))], 100_000);
        expect(out[0]).toBe(50_000);
        expect(out[1]).toBeCloseTo(25_000, 6);
        expect(out[2]).toBeCloseTo(25_000, 6);
    });

    it('refuses weights that exceed the portfolio', () => {
        expect(() => allocate([leg('A', rising(N), 0.7), leg('B', rising(N), 0.7)], 100_000)).toThrow(/more than the whole portfolio/);
    });

    it('allocates the whole portfolio and no more', () => {
        const out = allocate([leg('A', rising(N), 0.25), leg('B', rising(N)), leg('C', rising(N))], 999_999);
        expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(999_999, 4);
    });
});

describe('correlation', () => {
    it('is 1 against itself and −1 against its negation', () => {
        const a = [0.01, -0.02, 0.03, -0.01, 0.02];
        expect(correlate(a, a)).toBeCloseTo(1, 10);
        expect(correlate(a, a.map((x) => -x))).toBeCloseTo(-1, 10);
    });

    it('returns 0 for a flat series rather than NaN', () => {
        // A sleeve that never traded has zero variance. NaN would poison the matrix.
        expect(correlate([0.01, -0.01, 0.02], [0, 0, 0])).toBe(0);
        expect(Number.isNaN(correlate([0, 0, 0], [0, 0, 0]))).toBe(false);
    });
});

describe('portfolio backtest', () => {
    it('sums sleeve final values into the portfolio final value', () => {
        const r = run([leg('UP', rising(N)), leg('DOWN', falling(N))]);
        const sum = r.legs.reduce((n, l) => n + l.result.finalValue, 0);
        expect(r.equity[r.equity.length - 1]).toBeCloseTo(sum, 4);
    });

    it('computes portfolio drawdown from the COMBINED curve, not from the sleeves', () => {
        // This is the whole reason the module exists. Two sleeves moving oppositely
        // must produce a portfolio drawdown shallower than their weighted average.
        const r = run([leg('UP', rising(N)), leg('DOWN', falling(N))]);
        expect(r.metrics.maxDD).toBeGreaterThan(r.weightedLegMaxDD);
        expect(r.weightedLegMaxDD).toBeLessThan(0);
    });

    it('detects that identical instruments are one position, not two', () => {
        const bars = oscillating(N);
        const r = run([leg('A', bars), leg('B', bars)]);
        expect(r.correlation[0][1]).toBeCloseTo(1, 6);
        // No diversification is available, so the portfolio suffers the sleeve drawdown.
        expect(r.metrics.maxDD).toBeCloseTo(r.weightedLegMaxDD, 4);
    });

    it('aligns legs by timestamp rather than by array index', () => {
        // A shorter leg must not shift a longer one's history. Before its first bar the
        // short sleeve is cash and contributes exactly its allocation.
        const long = rising(N);
        const short = long.slice(-20);
        const r = run([leg('LONG', long), leg('SHORT', short)]);
        expect(r.timeline).toHaveLength(long.length);

        // At the first timestamp nothing is marked yet, so the portfolio is worth
        // exactly the capital put into it. This is what catches an off-by-one between
        // the bar index and the engine's equity samples, which start at bar 1.
        expect(r.equity[0]).toBeCloseTo(400_000, 6);

        // The short sleeve ran on its own 20 bars — the union did not stretch it.
        expect(r.legs[1].result.equity).toHaveLength(short.length - 1);
    });

    it('reports which sleeves never traded and why their correlation reads 0', () => {
        const r = runPortfolioBacktest({
            strategy: maCross,
            legs: [leg('FLAT', choppy(N)), leg('TREND', rising(N))],
            barSeconds: 86_400,
            startingCapital: 400_000,
        });
        const idle = r.legs.filter((l) => l.result.metrics.trades === 0);
        if (idle.length) {
            expect(r.warnings.join(' ')).toMatch(/took no trades/);
            expect(r.warnings.join(' ')).toMatch(/not because they are uncorrelated/);
        }
    });

    it('produces a symmetric correlation matrix with a unit diagonal', () => {
        const r = run([leg('A', rising(N)), leg('B', falling(N)), leg('C', oscillating(N))]);
        expect(r.correlation).toHaveLength(3);
        for (let i = 0; i < 3; i++) {
            expect(r.correlation[i][i]).toBeCloseTo(1, 6);
            for (let j = 0; j < 3; j++) expect(r.correlation[i][j]).toBeCloseTo(r.correlation[j][i], 10);
        }
    });

    it('never claims capital is shared between sleeves', () => {
        // The model funds each sleeve independently. Saying otherwise would overstate
        // what the number means.
        expect(run([leg('A', rising(N)), leg('B', falling(N))]).sharedCapital).toBe(false);
    });

    it('refuses a pair strategy rather than silently dropping its second series', () => {
        const pair = [...['pairs-zscore', 'crack-spread'].map(strategyById)].find((s) => s && s.shape !== 'single');
        if (!pair) return;
        expect(() => runPortfolioBacktest({
            strategy: pair,
            legs: [leg('A', rising(N)), leg('B', falling(N))],
            barSeconds: 86_400,
            startingCapital: 400_000,
        })).toThrow(/cannot be run as independent sleeves/);
    });

    it('refuses an empty portfolio', () => {
        expect(() => run([])).toThrow(/at least one instrument/);
    });

    it('carries every sleeve suppression up to the portfolio', () => {
        // Six sleeves of four trades each is 24 trades but not 24 observations of one
        // edge. Aggregating must not un-suppress a statistic.
        const r = run([leg('A', rising(N)), leg('B', falling(N))]);
        expect(Array.isArray(r.suppressed)).toBe(true);
        if (r.metrics.trades < 30) expect(r.suppressed.length).toBeGreaterThan(0);
    });
});
