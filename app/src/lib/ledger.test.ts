import { describe, it, expect } from 'vitest';
import { buildLedger, ledgerBalance } from './ledger';
import { newPaperState, placeOrder, recordRejection, ordersByStatus, openOrders, fillsForOrder,
         reconciliationError, type PaperState, type FxRates } from './paperEngine';
import type { LiveQuote } from '@/stores/marketStore';

const FX: FxRates = { INR: 1, USD: 83.2, JPY: 83.2 / 156.82, stale: false };
const quote = (symbol: string, price: number): LiveQuote => ({
    symbol, price, prevClose: price, change: 0, changePercent: 0, high: price, low: price, volume: 0, ts: 0, dir: null, real: true,
});
let clock = 1000;
const buy = (s: PaperState, sym: string, qty: number, px: number) =>
    placeOrder(s, { symbol: sym, side: 'buy', type: 'market', qty }, quote(sym, px), FX, clock++).state;
const sell = (s: PaperState, sym: string, qty: number, px: number) =>
    placeOrder(s, { symbol: sym, side: 'sell', type: 'market', qty }, quote(sym, px), FX, clock++).state;

describe('ledger', () => {
    it('closing balance equals account.cash after a long round trip', () => {
        let s = newPaperState();
        s = buy(s, 'AAPL', 5, 200);
        s = sell(s, 'AAPL', 5, 210);
        const rows = buildLedger(s, FX);
        expect(ledgerBalance(rows)).toBeCloseTo(s.account.cash, 4);
    });

    it('closing balance equals account.cash after a short round trip', () => {
        let s = newPaperState();
        s = sell(s, 'AAPL', 5, 200);
        s = buy(s, 'AAPL', 5, 190);
        const rows = buildLedger(s, FX);
        expect(ledgerBalance(rows)).toBeCloseTo(s.account.cash, 4);
    });

    it('closing balance tracks cash across a mixed sequence', () => {
        let s = newPaperState();
        s = buy(s, 'RELIANCE', 10, 1300);
        s = buy(s, 'AAPL', 3, 200);
        s = sell(s, 'RELIANCE', 4, 1320);
        s = sell(s, 'AAPL', 3, 195);
        expect(ledgerBalance(buildLedger(s, FX))).toBeCloseTo(s.account.cash, 4);
    });

    it('starts from the opening balance and records every fee', () => {
        // RELIANCE, not AAPL: an Indian buy pays brokerage, stamp duty, the exchange
        // transaction charge, the SEBI fee and GST. A US buy is genuinely free — the
        // SEC and FINRA fees are sell-side only — so it produces no fee row at all.
        let s = newPaperState();
        s = buy(s, 'RELIANCE', 2, 200);
        const rows = buildLedger(s, FX);
        expect(rows[0].kind).toBe('opening');
        expect(rows[0].balance).toBe(s.account.startingCash);
        expect(rows.filter((r) => r.kind === 'fee')).toHaveLength(1);
    });

    it('records no fee for a US buy, because there genuinely is none', () => {
        let s = newPaperState();
        s = buy(s, 'AAPL', 2, 200);
        expect(buildLedger(s, FX).filter((r) => r.kind === 'fee')).toHaveLength(0);
        expect(s.account.feesPaid).toBe(0);
    });

    it('reconciles even when two fills share a timestamp', () => {
        // Regression: a stable sort on ts alone preserved the store's newest-first
        // order, so the close was read before its own open and booked as a short.
        let s = newPaperState();
        s = placeOrder(s, { symbol: 'AAPL', side: 'buy', type: 'market', qty: 5 }, quote('AAPL', 200), FX, 7).state;
        s = placeOrder(s, { symbol: 'AAPL', side: 'sell', type: 'market', qty: 5 }, quote('AAPL', 210), FX, 7).state;
        expect(ledgerBalance(buildLedger(s, FX))).toBeCloseTo(s.account.cash, 4);
    });

    it('is empty-safe on a fresh account', () => {
        const rows = buildLedger(newPaperState(), FX);
        expect(ledgerBalance(rows)).toBe(500000);
    });
});

describe('recordRejection', () => {
    it('persists a rejected order with its reason', () => {
        const s = newPaperState();
        const { state, result } = recordRejection(s, { symbol: 'AAPL', side: 'buy', type: 'market', qty: 1 }, 'Kill-switch is on.', 5);
        expect(result.status).toBe('rejected');
        expect(result.orderId).toBeTruthy();
        const rejected = ordersByStatus(state, 'rejected');
        expect(rejected).toHaveLength(1);
        expect(rejected[0].rejectReason).toBe('Kill-switch is on.');
    });

    it('does not move cash or break the reconciliation identity', () => {
        const s = newPaperState();
        const { state } = recordRejection(s, { symbol: 'AAPL', side: 'buy', type: 'market', qty: 1 }, 'blocked', 5);
        expect(state.account.cash).toBe(s.account.cash);
        expect(state.orders[0].reservedBase).toBe(0);
        expect(Math.abs(reconciliationError(state))).toBeLessThan(1e-9);
    });

    it('keeps ids unique against engine-placed orders', () => {
        let s = newPaperState();
        s = buy(s, 'AAPL', 1, 200);
        const { state } = recordRejection(s, { symbol: 'AAPL', side: 'buy', type: 'market', qty: 1 }, 'blocked', 5);
        expect(new Set(state.orders.map((o) => o.id)).size).toBe(state.orders.length);
    });
});

describe('order selectors', () => {
    it('separates resting from filled, and links fills to their order', () => {
        let s = newPaperState();
        s = placeOrder(s, { symbol: 'AAPL', side: 'buy', type: 'limit', qty: 5, limitPrice: 1 }, quote('AAPL', 200), FX, 1).state;
        s = buy(s, 'AAPL', 2, 200);
        expect(openOrders(s)).toHaveLength(1);
        expect(ordersByStatus(s, 'filled')).toHaveLength(1);
        const filled = ordersByStatus(s, 'filled')[0];
        const fills = fillsForOrder(s, filled.id);
        expect(fills.length).toBeGreaterThan(0);
        expect(fills.every((f) => f.orderId === filled.id)).toBe(true);
    });
});
