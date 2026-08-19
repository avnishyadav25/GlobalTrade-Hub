import { describe, it, expect } from 'vitest';
import { evaluateStrategy, sizeForSignal, DEFAULT_COOLDOWN_MS, type EvaluationMemory } from './runtime';
import { HOLD, num, type Action, type Strategy, type StrategyContext } from './types';
import { rising, flat, series } from '@/test/candles';
import type { Candle } from '@/lib/mockData';

function testStrategy(onBar: (ctx: StrategyContext) => Action, over: Partial<Strategy> = {}): Strategy {
    return {
        id: `rt-${over.id ?? 'x'}`,
        name: 'Runtime test',
        family: 'trend',
        markets: ['us'],
        shape: 'single',
        params: [],
        warmup: () => 5,
        onBar,
        explain: { idea: '', entry: '', exit: '', whenItFails: '' },
        ...over,
    };
}

/** Always wants to be long. Useful for testing that repetition does NOT re-fire. */
const alwaysBuy = testStrategy(
    (ctx) => (ctx.position ? HOLD : { kind: 'enter', side: 'buy', sizing: { kind: 'equityPct', pct: 10 }, reason: 'always' }),
    { id: 'buy' }
);

const NOW = 1_800_000_000_000;
const evalWith = (strategy: Strategy, bars: Candle[], memory: EvaluationMemory = {}, over: Partial<Parameters<typeof evaluateStrategy>[0]> = {}) =>
    evaluateStrategy({
        strategy,
        symbol: 'AAPL',
        market: 'us',
        timeframe: '1d',
        barSeconds: 86_400,
        bars,
        position: null,
        equity: 100_000,
        memory,
        now: NOW,
        ...over,
    });

describe('warm-up', () => {
    it('produces nothing and records NO baseline before there is enough history', () => {
        // Arming on an unknown would make the first real reading look like a change.
        const r = evalWith(alwaysBuy, rising(4));
        expect(r.signal).toBeNull();
        expect(r.skipped).toBe('not-enough-bars');
        expect(r.memory).toEqual({});
    });

    it('fires once there is enough history', () => {
        const r = evalWith(alwaysBuy, rising(40));
        expect(r.signal).not.toBeNull();
        expect(r.signal?.side).toBe('buy');
        expect(r.signal?.intent).toBe('enter');
    });
});

describe('edge triggering', () => {
    it('does not fire again while the same decision stays true', () => {
        const first = evalWith(alwaysBuy, rising(40));
        expect(first.signal).not.toBeNull();

        // A later bar, same decision. Silence is the correct answer.
        const second = evalWith(alwaysBuy, rising(41), first.memory, { now: NOW + DEFAULT_COOLDOWN_MS + 1 });
        expect(second.signal).toBeNull();
        expect(second.skipped).toBe('no-change');
    });

    it('fires again when the decision actually changes', () => {
        const flip = testStrategy((ctx) => {
            const price = ctx.close(0)!;
            return price > 120
                ? { kind: 'enter', side: 'sell', sizing: { kind: 'equityPct', pct: 10 }, reason: 'high' }
                : { kind: 'enter', side: 'buy', sizing: { kind: 'equityPct', pct: 10 }, reason: 'low' };
        }, { id: 'flip' });

        const low = evalWith(flip, rising(15));
        expect(low.signal?.side).toBe('buy');

        const high = evalWith(flip, rising(40), low.memory, { now: NOW + DEFAULT_COOLDOWN_MS + 1 });
        expect(high.signal?.side).toBe('sell');
    });

    it('will not fire twice on the same bar', () => {
        const bars = rising(40);
        const first = evalWith(alwaysBuy, bars);
        const again = evalWith(alwaysBuy, bars, first.memory, { now: NOW + DEFAULT_COOLDOWN_MS + 1 });
        expect(again.signal).toBeNull();
    });

    it('records a baseline on HOLD so a later change is detectable', () => {
        const r = evalWith(testStrategy(() => HOLD, { id: 'hold' }), rising(40));
        expect(r.signal).toBeNull();
        expect(r.skipped).toBe('holding');
        expect(r.memory.lastKey).toBeDefined();
    });
});

describe('cooldown', () => {
    it('suppresses a second signal inside the window even when the decision changed', () => {
        const flip = testStrategy((ctx) => {
            const price = ctx.close(0)!;
            return price > 120
                ? { kind: 'enter', side: 'sell', sizing: { kind: 'equityPct', pct: 10 }, reason: 'high' }
                : { kind: 'enter', side: 'buy', sizing: { kind: 'equityPct', pct: 10 }, reason: 'low' };
        }, { id: 'flip2' });

        const first = evalWith(flip, rising(15));
        const soon = evalWith(flip, rising(40), first.memory, { now: NOW + 1_000 });
        expect(soon.signal).toBeNull();
        expect(soon.skipped).toBe('cooldown');
    });

    it('allows it once the window has passed', () => {
        const flip = testStrategy((ctx) => {
            const price = ctx.close(0)!;
            return price > 120
                ? { kind: 'enter', side: 'sell', sizing: { kind: 'equityPct', pct: 10 }, reason: 'high' }
                : { kind: 'enter', side: 'buy', sizing: { kind: 'equityPct', pct: 10 }, reason: 'low' };
        }, { id: 'flip3' });

        const first = evalWith(flip, rising(15));
        const later = evalWith(flip, rising(40), first.memory, { now: NOW + DEFAULT_COOLDOWN_MS + 1 });
        expect(later.signal).not.toBeNull();
    });
});

describe('what does and does not become a live signal', () => {
    it('turns an exit into an order on the opposite side of the position', () => {
        const exiter = testStrategy(() => ({ kind: 'exit', reason: 'done' }), { id: 'exit' });
        const long = evalWith(exiter, rising(40), {}, { position: { qty: 10, avgPrice: 100, entryIndex: 0 } });
        expect(long.signal?.intent).toBe('exit');
        expect(long.signal?.side).toBe('sell');

        const short = evalWith(exiter, rising(40), {}, { position: { qty: -10, avgPrice: 100, entryIndex: 0 } });
        expect(short.signal?.side).toBe('buy');
    });

    it('does NOT raise a signal for a resting order or a trailing stop', () => {
        // Both are backtest mechanics. A resting order goes through the order ticket, and
        // a trailing stop has no meaning until a live position exists.
        const rester = testStrategy(() => ({ kind: 'rest', side: 'buy', price: 90, sizing: { kind: 'equityPct', pct: 10 }, reason: 'rung' }), { id: 'rest' });
        expect(evalWith(rester, rising(40)).signal).toBeNull();

        const trailer = testStrategy(() => ({ kind: 'setStop', stop: 95, reason: 'trail' }), { id: 'trail' });
        expect(evalWith(trailer, rising(40)).signal).toBeNull();
    });

    it('carries the reason, the stop and the triggering bar onto the signal', () => {
        const withStop = testStrategy(
            (ctx) => ({ kind: 'enter', side: 'buy', sizing: { kind: 'equityPct', pct: 10 }, stop: ctx.close(0)! * 0.95, target: ctx.close(0)! * 1.1, reason: 'because' }),
            { id: 'stop' }
        );
        const bars = rising(40);
        const r = evalWith(withStop, bars);
        expect(r.signal?.reason).toBe('because');
        expect(r.signal?.stop).toBeCloseTo(bars[bars.length - 1].close * 0.95, 6);
        expect(r.signal?.target).toBeCloseTo(bars[bars.length - 1].close * 1.1, 6);
        expect(r.signal?.barTime).toBe(bars[bars.length - 1].time);
    });

    it('stays silent on a flat market', () => {
        const trend = testStrategy((ctx) => {
            const fast = ctx.ind.sma(5);
            const slow = ctx.ind.sma(20);
            if (fast == null || slow == null || fast <= slow) return HOLD;
            return { kind: 'enter', side: 'buy', sizing: { kind: 'equityPct', pct: 10 }, reason: 'up' };
        }, { id: 'trend', warmup: () => 20 });
        expect(evalWith(trend, flat(60)).signal).toBeNull();
    });
});

describe('sizeForSignal', () => {
    const signal = {
        id: 'x', strategyId: 's', strategyName: 'S', symbol: 'AAPL', market: 'us' as const,
        timeframe: '1d', intent: 'enter' as const, side: 'buy' as const,
        price: 100, reason: '', params: {}, barTime: 0, createdAt: 0,
    };

    it('sizes from the distance to the stop', () => {
        // Risking 1% of ₹1,00,000 with a ₹5 stop distance is 200 units.
        const qty = sizeForSignal({
            signal: { ...signal, stop: 95 },
            equityBase: 100_000, priceBase: 100, riskPct: 1,
            fractional: false, maxOrderValueBase: 1_000_000,
        });
        expect(qty).toBe(200);
    });

    it('gives a tighter stop a larger position for the same risk', () => {
        const common = { equityBase: 100_000, priceBase: 100, riskPct: 1, fractional: false, maxOrderValueBase: 1_000_000 };
        const tight = sizeForSignal({ signal: { ...signal, stop: 99 }, ...common });
        const wide = sizeForSignal({ signal: { ...signal, stop: 90 }, ...common });
        expect(tight).toBeGreaterThan(wide);
    });

    it('falls back to the order-value cap when there is no stop, rather than inventing one', () => {
        const qty = sizeForSignal({
            signal, equityBase: 100_000, priceBase: 100, riskPct: 1,
            fractional: false, maxOrderValueBase: 5_000,
        });
        expect(qty).toBe(50);
    });

    it('never exceeds the order-value cap or available equity', () => {
        const qty = sizeForSignal({
            signal: { ...signal, stop: 99.99 },     // absurdly tight: implies huge size
            equityBase: 100_000, priceBase: 100, riskPct: 1,
            fractional: false, maxOrderValueBase: 20_000,
        });
        expect(qty).toBeLessThanOrEqual(200);
    });

    it('returns zero rather than a fraction of a share for a non-fractional instrument', () => {
        const qty = sizeForSignal({
            signal, equityBase: 100_000, priceBase: 100, riskPct: 1,
            fractional: false, maxOrderValueBase: 50,
        });
        expect(qty).toBe(0);
    });

    it('allows fractional size where the instrument permits it', () => {
        const qty = sizeForSignal({
            signal, equityBase: 100_000, priceBase: 100, riskPct: 1,
            fractional: true, maxOrderValueBase: 50,
        });
        expect(qty).toBeGreaterThan(0);
        expect(Number.isInteger(qty)).toBe(false);
    });

    it('returns zero for a nonsensical price or equity', () => {
        for (const bad of [0, -1, Number.NaN]) {
            expect(sizeForSignal({ signal, equityBase: 100_000, priceBase: bad, riskPct: 1, fractional: true, maxOrderValueBase: 1000 })).toBe(0);
            expect(sizeForSignal({ signal, equityBase: bad, priceBase: 100, riskPct: 1, fractional: true, maxOrderValueBase: 1000 })).toBe(0);
        }
    });
});
