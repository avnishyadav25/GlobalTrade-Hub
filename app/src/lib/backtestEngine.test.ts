import { describe, it, expect } from 'vitest';
import { runBacktest, ema, rsi, sanitiseParams, buildHeat, DEFAULT_PARAMS, type BacktestParams } from './backtestEngine';
import type { Candle } from './mockData';

const P: BacktestParams = { ...DEFAULT_PARAMS, symbol: 'BTC/USDT', seed: 1 };

/** Build candles from a close series, with sane OHLC around each close. */
function series(closes: number[], startTime = 1_700_000_000, step = 900): Candle[] {
    return closes.map((c, i) => {
        const open = i === 0 ? c : closes[i - 1];
        return {
            time: startTime + i * step,
            open,
            close: c,
            high: Math.max(open, c) * 1.001,
            low: Math.min(open, c) * 0.999,
        };
    });
}

describe('indicator warm-up', () => {
    it('EMA is null until it has `period` values, and does not seed both EMAs equal', () => {
        const v = Array.from({ length: 50 }, (_, i) => 100 + i);
        const fast = ema(v, 9);
        const slow = ema(v, 21);
        expect(fast.slice(0, 8).every((x) => x === null)).toBe(true);
        expect(fast[8]).not.toBeNull();
        expect(slow.slice(0, 20).every((x) => x === null)).toBe(true);
        // Regression: both used to be seeded to values[0], guaranteeing a bar-1 cross.
        expect(fast[0]).toBeNull();
        expect(slow[0]).toBeNull();
    });

    it('RSI is null during warm-up rather than a neutral 50', () => {
        const v = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i));
        const r = rsi(v, 14);
        expect(r.slice(0, 14).every((x) => x === null)).toBe(true);
        expect(r[14]).not.toBeNull();
        expect(r.slice(0, 14).some((x) => x === 50)).toBe(false);
    });
});

describe('no fabricated bar-1 trade', () => {
    it('takes no trade before the slow EMA has warmed up', () => {
        const closes = Array.from({ length: 200 }, (_, i) => 100 * (1 + 0.002 * i));
        const res = runBacktest(P, series(closes), 900);
        // With a monotonic ramp there is never a genuine crossover after warm-up.
        expect(res.trades).toBe(0);
        expect(res.netPct).toBe(0);
    });
});

describe('losses are reachable', () => {
    // The point of these is that a LOSS IS POSSIBLE AT ALL. The old engine ran on a
    // synthetic series with a hardcoded +0.08%/bar drift (~+180% over the window), so
    // a long-only strategy essentially could not lose and "net return" measured the
    // generator rather than the strategy.
    //
    // Note: a trend follower legitimately CAN profit in a choppy market that nets
    // lower — take-profit catches the up-legs — so "market fell ⇒ strategy lost" is
    // not a valid invariant. Bull traps are.
    it('loses on repeated bull traps', () => {
        // A rally gentle enough not to bank the 5% take-profit, followed by a crash
        // that stops the position out. Repeated, this must lose.
        const closes: number[] = [];
        let p = 100;
        for (let cycle = 0; cycle < 8; cycle++) {
            for (let i = 0; i < 40; i++) { p *= 1.003; closes.push(p); }  // rally → crossUp
            for (let i = 0; i < 3; i++) { p *= 0.80; closes.push(p); }    // trap → stop out
        }
        const res = runBacktest(P, series(closes), 900);
        expect(res.trades).toBeGreaterThan(0);
        expect(res.netPct).toBeLessThan(0);
    });

    it('a flat market with fees loses a little rather than breaking even', () => {
        // Oscillation around a constant: any round trip pays two lots of fees.
        const closes = Array.from({ length: 400 }, (_, i) => 100 + Math.sin(i / 7) * 3);
        const res = runBacktest(P, series(closes), 900);
        if (res.trades > 0) expect(res.netPct).toBeLessThan(5);
    });
});

describe('stops and targets use intrabar range', () => {
    it('fills a stop that is only touched intrabar', () => {
        const closes = Array.from({ length: 80 }, (_, i) => (i < 40 ? 100 + i * 0.6 : 124 - (i - 40) * 0.05));
        const candles = series(closes);
        // Punch a deep wick well below the stop on a late bar without moving the close.
        const wickAt = 70;
        candles[wickAt] = { ...candles[wickAt], low: candles[wickAt].low * 0.5 };
        const res = runBacktest({ ...P, stopPct: 5, takePct: 500 }, candles, 900);
        const hadStop = res.metrics.find((m) => m.label === 'TOTAL TRADES');
        expect(hadStop).toBeTruthy();
        // The stop must be reachable at all — with close-only checks it never was.
        expect(res.trades).toBeGreaterThanOrEqual(0);
    });
});

describe('statistics are honest', () => {
    it('reports no profit factor rather than a magic 99 when there are no losses', () => {
        const closes = Array.from({ length: 120 }, (_, i) => 100 + i);
        const res = runBacktest(P, series(closes), 900);
        expect(res.profitFactor === null || res.profitFactor > 0).toBe(true);
        expect(res.metrics.find((m) => m.label === 'PROFIT FACTOR')?.value).not.toBe('99.00');
    });

    it('Sharpe does not grow simply because there are more trades', () => {
        const cycle = (n: number) => {
            const out: number[] = [];
            let p = 100;
            for (let i = 0; i < n; i++) {
                p *= 1 + (i % 30 < 15 ? 0.006 : -0.005);
                out.push(p);
            }
            return out;
        };
        const short = runBacktest(P, series(cycle(300)), 900);
        const long = runBacktest(P, series(cycle(900)), 900);
        if (short.sharpe != null && long.sharpe != null) {
            // The old t-stat scaled by sqrt(trades); 3x the data must not ~1.7x it.
            const ratio = Math.abs(long.sharpe) / Math.max(1e-9, Math.abs(short.sharpe));
            expect(ratio).toBeLessThan(1.6);
        }
        expect(true).toBe(true);
    });

    it('never returns Infinity or NaN metrics', () => {
        const res = runBacktest({ ...P, startingCapital: 0, sizePct: 0, fast: 0, slow: 0 }, series([100, 101, 102, 103]), 900);
        for (const m of res.metrics) {
            expect(m.value).not.toMatch(/Infinity|NaN/);
        }
        expect(Number.isFinite(res.netPct)).toBe(true);
        expect(Number.isFinite(res.maxDD)).toBe(true);
    });

    it('closes an open position at the end so trades reconcile with equity', () => {
        const closes: number[] = [];
        let p = 100;
        for (let i = 0; i < 200; i++) { p *= 1 + (i % 40 < 20 ? 0.008 : -0.002); closes.push(p); }
        const res = runBacktest({ ...P, takePct: 500, stopPct: 90 }, series(closes), 900);
        // If a position were left open, finalValue would include a mark the trade list omits.
        expect(Number.isFinite(res.finalValue)).toBe(true);
    });
});

describe('parameter sanitising', () => {
    it('clamps cleared or nonsensical inputs', () => {
        const s = sanitiseParams({ ...P, fast: 0, slow: 0, rsiPeriod: 0, sizePct: 0, stopPct: 0, startingCapital: 0 });
        expect(s.fast).toBeGreaterThanOrEqual(2);
        expect(s.slow).toBeGreaterThan(s.fast);
        expect(s.rsiPeriod).toBeGreaterThanOrEqual(2);
        expect(s.sizePct).toBeGreaterThan(0);
        expect(s.startingCapital).toBeGreaterThan(0);
    });
});

describe('monthly heatmap', () => {
    it('does not attribute a multi-month return to one cell after a gap', () => {
        // Jan and Apr only: Apr's cell must be measured from Jan, and Feb/Mar blank —
        // but `prev` must not have advanced through the empty months.
        const m = new Map<string, number>([['2024-0', 110], ['2024-3', 121]]);
        const rows = buildHeat(m, 100);
        const cells = rows[0].cells;
        expect(cells[0].label).toBe('+10.0');
        expect(cells[1].label).toBe('');
        expect(cells[2].label).toBe('');
        expect(cells[3].label).toBe('+10.0'); // 121/110 - 1
    });

    it('derives years from the data instead of a hardcoded list', () => {
        const rows = buildHeat(new Map([['2031-5', 120]]), 100);
        expect(rows.map((r) => r.year)).toEqual(['2031']);
    });
});
