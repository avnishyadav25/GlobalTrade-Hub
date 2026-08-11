import { describe, it, expect } from 'vitest';
import { runStrategyBacktest, barsPerYear, MIN_TRADES_FOR_STATS } from './backtest';
import { sanitiseParams, defaultParams, HOLD, num, type Action, type Strategy, type StrategyContext } from './types';
import type { Candle } from '@/lib/mockData';

/* ------------------------------------------------------------------ fixtures */

const bar = (time: number, o: number, h: number, l: number, c: number): Candle => ({
    time, open: o, high: h, low: l, close: c, volume: 1000,
});

/** Flat then rising, with a wide enough range that stops are reachable. */
const series = (closes: number[], spread = 0.5): Candle[] =>
    closes.map((c, i) => bar(1_700_000_000 + i * 86_400, c, c + spread, c - spread, c));

const rising = (n: number, step = 1, start = 100) => series(Array.from({ length: n }, (_, i) => start + i * step));
const falling = (n: number, step = 1, start = 300) => series(Array.from({ length: n }, (_, i) => start - i * step));
const flat = (n: number, v = 100) => series(Array.from({ length: n }, () => v));

const base = {
    symbol: 'AAPL',
    market: 'us' as const,
    barSeconds: 86_400,
    startingCapital: 100_000,
};

/** A strategy built from a plain decision function, so tests stay readable. */
function testStrategy(
    onBar: (ctx: StrategyContext) => Action,
    over: Partial<Strategy> = {}
): Strategy {
    return {
        id: `t-${Math.abs(onBar.toString().length)}-${over.id ?? 'x'}`,
        name: 'Test',
        family: 'trend',
        markets: ['us', 'crypto', 'india'],
        shape: 'single',
        params: [],
        warmup: () => 0,
        onBar,
        explain: { idea: '', entry: '', exit: '', whenItFails: '' },
        ...over,
    };
}

const holdForever = testStrategy(() => HOLD, { id: 'hold' });

/** Long on the first eligible bar, then hold to the end. */
const buyAndStay = testStrategy(
    (ctx) => (ctx.position ? HOLD : { kind: 'enter', side: 'buy', sizing: { kind: 'equityPct', pct: 100 }, reason: 'in' }),
    { id: 'stay' }
);

/* -------------------------------------------------------- the lookahead proof */

describe('the lookahead guarantee', () => {
    it('never shows a strategy a bar it should not be able to see', () => {
        const bars = rising(40);
        const seen: { i: number; close: number; ahead: number | undefined }[] = [];

        const spy = testStrategy((ctx) => {
            seen.push({
                i: ctx.i,
                close: ctx.close(0)!,
                // There is no way to ASK for a future bar: `back` counts backwards and
                // clamps at zero. This records what a negative offset actually returns.
                ahead: ctx.close(-5),
            });
            return HOLD;
        }, { id: 'spy' });

        runStrategyBacktest({ ...base, strategy: spy, bars });

        for (const s of seen) {
            expect(s.close).toBe(bars[s.i].close);
            expect(s.ahead).toBe(bars[s.i].close);   // clamped to now, not the future
        }
        // The strategy decides on bar i-1 and fills on bar i, so it never sees the last bar.
        expect(Math.max(...seen.map((s) => s.i))).toBe(bars.length - 2);
    });

    it('produces identical trades when the series is truncated', () => {
        // The strongest available check: if any decision depended on a future bar, adding
        // more bars to the END would change decisions made EARLIER. It must not.
        const long = rising(60);
        const short = long.slice(0, 35);

        const strat = testStrategy((ctx) => {
            const fast = ctx.ind.sma(5);
            const slow = ctx.ind.sma(20);
            if (fast == null || slow == null) return HOLD;
            if (!ctx.position && fast > slow) {
                return { kind: 'enter', side: 'buy', sizing: { kind: 'equityPct', pct: 50 }, reason: 'cross up' };
            }
            if (ctx.position && fast < slow) return { kind: 'exit', reason: 'cross down' };
            return HOLD;
        }, { id: 'cross' });

        const a = runStrategyBacktest({ ...base, strategy: strat, bars: long });
        const b = runStrategyBacktest({ ...base, strategy: strat, bars: short });

        const within = a.trades.filter((t) => t.exitIndex < short.length - 1);
        for (let i = 0; i < within.length; i++) {
            expect(b.trades[i].entryIndex).toBe(within[i].entryIndex);
            expect(b.trades[i].entryPrice).toBeCloseTo(within[i].entryPrice, 8);
        }
    });

    it('reveals an event only once the cursor has passed it', () => {
        const bars = rising(30);
        const eventTime = bars[20].time;
        const counts: number[] = [];

        const strat = testStrategy((ctx) => {
            counts[ctx.i] = ctx.events.length;
            return HOLD;
        }, { id: 'ev' });

        runStrategyBacktest({
            ...base,
            strategy: strat,
            bars,
            events: [{ time: eventTime, kind: 'earnings', actual: 2, estimate: 1 }],
        });

        expect(counts[19]).toBe(0);   // before the event
        expect(counts[20]).toBe(1);   // on the bar it happens
    });
});

/* --------------------------------------------------------------- basic engine */

describe('trading mechanics', () => {
    it('takes no trades when the strategy always holds', () => {
        const r = runStrategyBacktest({ ...base, strategy: holdForever, bars: rising(50) });
        expect(r.trades).toEqual([]);
        expect(r.finalValue).toBe(100_000);
        expect(r.metrics.exposure).toBe(0);
    });

    it('force-closes a position still open at the end and warns', () => {
        const r = runStrategyBacktest({ ...base, strategy: buyAndStay, bars: rising(40) });
        expect(r.trades).toHaveLength(1);
        expect(r.trades[0].reason).toBe('forced');
        expect(r.warnings.some((w) => /open at the end/i.test(w))).toBe(true);
    });

    it('makes money long in a rising market and loses it in a falling one', () => {
        const up = runStrategyBacktest({ ...base, strategy: buyAndStay, bars: rising(40) });
        const down = runStrategyBacktest({ ...base, strategy: buyAndStay, bars: falling(40) });
        expect(up.metrics.netPct).toBeGreaterThan(0);
        expect(down.metrics.netPct).toBeLessThan(0);
    });

    it('makes money SHORT in a falling market — the direction the old engine could not trade', () => {
        const shortAndStay = testStrategy(
            (ctx) => (ctx.position ? HOLD : { kind: 'enter', side: 'sell', sizing: { kind: 'equityPct', pct: 50 }, reason: 'short' }),
            { id: 'short' }
        );
        const r = runStrategyBacktest({ ...base, strategy: shortAndStay, bars: falling(40) });
        expect(r.trades[0].side).toBe('short');
        expect(r.metrics.netPct).toBeGreaterThan(0);
    });

    it('reverses rather than stacking when the signal flips', () => {
        let flip = false;
        const flipper = testStrategy((ctx) => {
            if (ctx.i < 5) return HOLD;
            const side = flip ? 'sell' : 'buy';
            if (ctx.position && Math.sign(ctx.position.qty) === (side === 'buy' ? 1 : -1)) return HOLD;
            flip = !flip;
            return { kind: 'enter', side, sizing: { kind: 'equityPct', pct: 40 }, reason: 'flip' };
        }, { id: 'flip' });

        const r = runStrategyBacktest({ ...base, strategy: flipper, bars: rising(30) });
        expect(r.trades.length).toBeGreaterThan(1);
        // Every trade closed before the next opened — never two positions at once.
        for (let i = 1; i < r.trades.length; i++) {
            expect(r.trades[i].entryIndex).toBeGreaterThanOrEqual(r.trades[i - 1].exitIndex);
        }
    });

    it('rounds to whole units for a non-fractional instrument', () => {
        const r = runStrategyBacktest({ ...base, symbol: 'AAPL', strategy: buyAndStay, bars: rising(20) });
        expect(Number.isInteger(r.trades[0].qty)).toBe(true);
    });

    it('allows fractional size for crypto', () => {
        const r = runStrategyBacktest({
            ...base, symbol: 'BTC/USDT', market: 'crypto', strategy: buyAndStay,
            bars: series(Array.from({ length: 20 }, (_, i) => 60_000 + i * 100)),
        });
        expect(Number.isInteger(r.trades[0].qty)).toBe(false);
    });
});

/* -------------------------------------------------------------- stops/targets */

describe('stops and targets', () => {
    const withStop = (stopPct: number, targetPct: number) =>
        testStrategy((ctx) => {
            if (ctx.position || ctx.i < 2) return HOLD;
            const px = ctx.close(0)!;
            return {
                kind: 'enter', side: 'buy', sizing: { kind: 'equityPct', pct: 50 },
                stop: px * (1 - stopPct), target: px * (1 + targetPct), reason: 'entry',
            };
        }, { id: `st${stopPct}` });

    it('resolves the STOP first when one bar touches both', () => {
        // Bar ordering inside a candle is unknowable, so the conservative reading is
        // the only honest one.
        const bars: Candle[] = [
            bar(1, 100, 101, 99, 100),
            bar(2, 100, 101, 99, 100),
            bar(3, 100, 101, 99, 100),
            bar(4, 100, 101, 99, 100),   // entry fills here, at the open
            bar(5, 100, 130, 70, 100),   // touches a +5% target AND a −5% stop
            bar(6, 100, 101, 99, 100),
        ];
        const r = runStrategyBacktest({ ...base, strategy: withStop(0.05, 0.05), bars });
        expect(r.trades[0].reason).toBe('stop');
    });

    it('fills at the OPEN when the bar gaps through the stop', () => {
        const bars: Candle[] = [
            bar(1, 100, 101, 99, 100),
            bar(2, 100, 101, 99, 100),
            bar(3, 100, 101, 99, 100),
            bar(4, 100, 101, 99, 100),   // entry fills here, at the open
            bar(5, 80, 81, 79, 80),      // gaps far below a 95 stop
            bar(6, 80, 81, 79, 80),
        ];
        const r = runStrategyBacktest({ ...base, strategy: withStop(0.05, 0.20), bars });
        expect(r.trades[0].reason).toBe('stop');
        // Filled near 80, not at the 95 stop — you do not get the price you asked for.
        expect(r.trades[0].exitPrice).toBeLessThan(85);
    });

    it('reports an R-multiple only when the trade had a stop', () => {
        const withR = runStrategyBacktest({ ...base, strategy: withStop(0.05, 0.10), bars: rising(30) });
        expect(withR.trades[0].rMultiple).not.toBeNull();

        const noR = runStrategyBacktest({ ...base, strategy: buyAndStay, bars: rising(30) });
        expect(noR.trades[0].rMultiple).toBeNull();
    });

    it('sizes from risk, so a tighter stop buys more units', () => {
        const sized = (stopPct: number) =>
            testStrategy((ctx) => {
                if (ctx.position || ctx.i < 2) return HOLD;
                const px = ctx.close(0)!;
                const stop = px * (1 - stopPct);
                return { kind: 'enter', side: 'buy', sizing: { kind: 'riskPct', pct: 1, stop }, stop, reason: 'r' };
            }, { id: `rk${stopPct}` });

        const tight = runStrategyBacktest({ ...base, strategy: sized(0.01), bars: rising(30) });
        const wide = runStrategyBacktest({ ...base, strategy: sized(0.05), bars: rising(30) });
        expect(tight.trades[0].qty).toBeGreaterThan(wide.trades[0].qty);
    });

    it('caps size at available capital when the stop is unrealistically tight', () => {
        // Risking 1% with the stop a hair from the entry implies ~30x leverage. The
        // arithmetic is correct and the position is not: an unleveraged account can
        // never hold more than its own equity.
        const tooTight = testStrategy((ctx) => {
            if (ctx.position || ctx.i < 2) return HOLD;
            const px = ctx.close(0)!;
            return { kind: 'enter', side: 'buy', sizing: { kind: 'riskPct', pct: 1, stop: px }, reason: 'hair-thin stop' };
        }, { id: 'tight' });

        const r = runStrategyBacktest({ ...base, strategy: tooTight, bars: rising(30) });
        const t = r.trades[0];
        expect(t.qty * t.entryPrice).toBeLessThanOrEqual(base.startingCapital);
    });

    it('takes no trade at all when the risk per unit is exactly zero', () => {
        const zeroRisk = testStrategy((ctx) => {
            if (ctx.position || ctx.i < 2) return HOLD;
            // Stop AT the fill price: infinite size, which is not a position.
            const next = ctx.close(0)!;
            return { kind: 'enter', side: 'buy', sizing: { kind: 'atrRisk', pct: 1, atrMult: 0, atr: 0 }, stop: next, reason: 'zero' };
        }, { id: 'zeroatr' });

        expect(runStrategyBacktest({ ...base, strategy: zeroRisk, bars: rising(30) }).trades).toEqual([]);
    });

    it('is exposed to the remainder of the bar it entered on', () => {
        // The original engine checked exits BEFORE entries, so a position opened at a
        // bar's open was immune to that bar's own crash. A strategy that bought right
        // before a collapse appeared to survive it.
        const bars: Candle[] = [
            bar(1, 100, 101, 99, 100),
            bar(2, 100, 101, 99, 100),
            bar(3, 100, 101, 99, 100),
            bar(4, 100, 101, 60, 65),   // enters at this open, then collapses within it
            bar(5, 65, 66, 64, 65),
        ];
        const r = runStrategyBacktest({ ...base, strategy: withStop(0.05, 0.5), bars });
        expect(r.trades[0].reason).toBe('stop');
        expect(r.trades[0].exitIndex).toBe(3);
    });
});

/* ------------------------------------------------------------------- metrics */

describe('metrics', () => {
    it('annualises by the market session, not the calendar', () => {
        // 15-minute NSE bars: 252 days x 22500s / 900s = 6,300 bars a year.
        // The old engine assumed 35,040 — inflating an annualised Sharpe by ~2.4x.
        expect(barsPerYear('india', 900)).toBeCloseTo(6300, 0);
        expect(barsPerYear('india', 86_400)).toBeCloseTo(252, 0);
        expect(barsPerYear('crypto', 86_400)).toBeCloseTo(365, 0);
    });

    it('computes a buy-and-hold benchmark to compare against', () => {
        const bars = rising(300);
        const r = runStrategyBacktest({ ...base, strategy: holdForever, bars });
        const instrumentReturn = (bars[bars.length - 1].close / bars[1].open - 1) * 100;
        // Slightly below the raw return because the benchmark pays costs both ways.
        expect(r.metrics.benchmarkPct).toBeLessThan(instrumentReturn);
        expect(r.metrics.benchmarkPct).toBeGreaterThan(instrumentReturn - 2);
    });

    it('withholds ratio statistics when the sample is too small', () => {
        const r = runStrategyBacktest({ ...base, strategy: buyAndStay, bars: rising(40) });
        expect(r.trades.length).toBeLessThan(MIN_TRADES_FOR_STATS);
        expect(r.metrics.sharpe).toBeNull();
        expect(r.metrics.winRate).toBeNull();
        expect(r.metrics.profitFactor).toBeNull();
        expect(r.suppressed).toContain('Sharpe');
        expect(r.warnings.some((w) => /too small a sample/i.test(w))).toBe(true);
    });

    it('still reports the net return, which needs no sample to be true', () => {
        const r = runStrategyBacktest({ ...base, strategy: buyAndStay, bars: rising(40) });
        expect(Number.isFinite(r.metrics.netPct)).toBe(true);
        expect(r.metrics.trades).toBe(1);
    });

    it('tracks exposure and turnover', () => {
        const r = runStrategyBacktest({ ...base, strategy: buyAndStay, bars: rising(40) });
        expect(r.metrics.exposure).toBeGreaterThan(0.8);
        expect(r.metrics.turnover).toBeGreaterThan(0);
    });

    it('never emits NaN or Infinity anywhere in the metrics', () => {
        for (const bars of [flat(50), rising(50), falling(50), rising(3)]) {
            const r = runStrategyBacktest({ ...base, strategy: buyAndStay, bars });
            for (const [k, v] of Object.entries(r.metrics)) {
                if (typeof v === 'number') expect(Number.isFinite(v), `${k} = ${v}`).toBe(true);
            }
        }
    });

    it('handles a series too short to trade without throwing', () => {
        const r = runStrategyBacktest({ ...base, strategy: buyAndStay, bars: rising(1) });
        expect(r.trades).toEqual([]);
        expect(r.warnings.length).toBeGreaterThan(0);
    });
});

/* -------------------------------------------------------------------- params */

describe('ParamSpec-driven sanitisation', () => {
    const strat: Strategy = testStrategy(() => HOLD, {
        id: 'params',
        params: [
            { key: 'fast', label: 'Fast', help: '', type: 'int', min: 2, max: 200, default: 9 },
            { key: 'slow', label: 'Slow', help: '', type: 'int', min: 3, max: 400, default: 21 },
            { key: 'risk', label: 'Risk', help: '', type: 'pct', min: 0.1, max: 10, default: 1 },
            { key: 'mode', label: 'Mode', help: '', type: 'choice', choices: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], default: 'a' },
        ],
        normalise: (p) => ({ ...p, fast: Math.min(num(p, 'fast'), num(p, 'slow') - 1) }),
    });

    it('falls back to the default for a cleared or non-numeric field', () => {
        expect(sanitiseParams(strat, { fast: Number.NaN })).toMatchObject({ fast: 9 });
        expect(sanitiseParams(strat, { risk: 'nonsense' })).toMatchObject({ risk: 1 });
    });

    it('clamps to the declared bounds and rounds integers', () => {
        expect(sanitiseParams(strat, { fast: 5000 })).toMatchObject({ fast: 20 }); // then normalised below slow
        expect(sanitiseParams(strat, { fast: 4.7, slow: 50 })).toMatchObject({ fast: 5 });
        expect(sanitiseParams(strat, { risk: 99 })).toMatchObject({ risk: 10 });
    });

    it('rejects an unknown choice', () => {
        expect(sanitiseParams(strat, { mode: 'z' })).toMatchObject({ mode: 'a' });
        expect(sanitiseParams(strat, { mode: 'b' })).toMatchObject({ mode: 'b' });
    });

    it('applies cross-field normalisation a per-field clamp cannot express', () => {
        expect(sanitiseParams(strat, { fast: 30, slow: 10 })).toMatchObject({ fast: 9, slow: 10 });
    });

    it('defaults come straight from the specs, with no second copy to drift', () => {
        expect(defaultParams(strat)).toEqual({ fast: 9, slow: 21, risk: 1, mode: 'a' });
    });
});
