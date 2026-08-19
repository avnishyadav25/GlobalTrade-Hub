import { describe, it, expect } from 'vitest';
import { evaluateAlerts, describeAlert, ALERT_COOLDOWN_MS, type Alert, type AlertContext } from './alerts';
import type { LiveQuote } from '@/stores/marketStore';

const q = (symbol: string, price: number, changePercent = 0): LiveQuote => ({
    symbol, price, prevClose: price, change: 0, changePercent, high: price, low: price, volume: 0, ts: 0, dir: null, real: true,
});
const ctx = (price: number, opts: { rsi?: number | null; changePct?: number } = {}): AlertContext => ({
    quotes: { 'BTC/USDT': q('BTC/USDT', price, opts.changePct ?? 0) },
    rsi: () => (opts.rsi === undefined ? 50 : opts.rsi),
    range24h: () => ({ high: price * 1.05, low: price * 0.95 }),
});
const alert = (o: Partial<Alert> = {}): Alert => ({
    id: 'a1', symbol: 'BTC/USDT', kind: 'price', op: 'above', value: 100,
    repeat: true, enabled: true, notify: false, createdAt: 0, triggerCount: 0, ...o,
});

describe('edge triggering', () => {
    it('does not fire on the first pass, even when already true', () => {
        // Otherwise creating an alert on a condition that already holds fires instantly.
        const r = evaluateAlerts([alert()], ctx(150));
        expect(r.triggered).toHaveLength(0);
        expect(r.readings.a1).toBe(150);
    });

    it('fires exactly once on the crossing', () => {
        const armed = alert({ lastValue: 90 });
        expect(evaluateAlerts([armed], ctx(150)).triggered).toHaveLength(1);
    });

    it('does NOT fire again while the condition stays true', () => {
        // The bug this prevents: a `price > X` alert firing 60 times a minute forever.
        const stillTrue = alert({ lastValue: 150 });
        expect(evaluateAlerts([stillTrue], ctx(160)).triggered).toHaveLength(0);
    });

    it('re-fires after the condition resets and crosses again', () => {
        expect(evaluateAlerts([alert({ lastValue: 95 })], ctx(150)).triggered).toHaveLength(1);
    });

    it('handles the below direction symmetrically', () => {
        const a = alert({ op: 'below', value: 100, lastValue: 110 });
        expect(evaluateAlerts([a], ctx(90)).triggered).toHaveLength(1);
        expect(evaluateAlerts([alert({ op: 'below', value: 100, lastValue: 90 })], ctx(80)).triggered).toHaveLength(0);
    });
});

describe('warm-up safety', () => {
    it('never fires an RSI alert while RSI is null', () => {
        const a = alert({ kind: 'rsi', op: 'below', value: 35, lastValue: 60 });
        const r = evaluateAlerts([a], ctx(100, { rsi: null }));
        expect(r.triggered).toHaveLength(0);
        // and records no baseline, so it can't arm off unknown data either
        expect(r.readings.a1).toBeUndefined();
    });

    it('fires an RSI alert once RSI is known and crosses', () => {
        const a = alert({ kind: 'rsi', op: 'below', value: 35, lastValue: 60 });
        expect(evaluateAlerts([a], ctx(100, { rsi: 30 })).triggered).toHaveLength(1);
    });

    it('ignores a symbol with no quote', () => {
        const a = alert({ symbol: 'NOPE', lastValue: 1 });
        expect(evaluateAlerts([a], ctx(100)).triggered).toHaveLength(0);
    });
});

describe('cooldown and enablement', () => {
    it('suppresses a re-fire inside the cooldown', () => {
        const now = 1_000_000;
        const a = alert({ lastValue: 90, lastTriggeredAt: now - ALERT_COOLDOWN_MS / 2 });
        expect(evaluateAlerts([a], ctx(150), now).triggered).toHaveLength(0);
    });

    it('allows a re-fire after the cooldown', () => {
        const now = 1_000_000;
        const a = alert({ lastValue: 90, lastTriggeredAt: now - ALERT_COOLDOWN_MS - 1 });
        expect(evaluateAlerts([a], ctx(150), now).triggered).toHaveLength(1);
    });

    it('skips disabled alerts entirely', () => {
        expect(evaluateAlerts([alert({ enabled: false, lastValue: 90 })], ctx(150)).triggered).toHaveLength(0);
    });
});

describe('change-percent alerts', () => {
    it('fires on a percentage move', () => {
        const a = alert({ kind: 'changePct', op: 'above', value: 5, lastValue: 1 });
        expect(evaluateAlerts([a], ctx(100, { changePct: 7 })).triggered).toHaveLength(1);
    });
});

describe('describeAlert', () => {
    it('reads as a sentence', () => {
        expect(describeAlert(alert())).toBe('Price above 100');
        expect(describeAlert(alert({ kind: 'changePct', op: 'below', value: -3 }))).toBe('Change below -3%');
    });
});
