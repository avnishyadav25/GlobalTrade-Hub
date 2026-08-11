import { describe, it, expect } from 'vitest';
import {
    newPaperState,
    placeOrder,
    cancelOrder,
    processTick,
    assertReconciled,
    reconciliationError,
    equity,
    buyingPower,
    realizedNet,
    realizedGross,
    feesPaid,
    winRate,
    toBase,
    quoteCcyOf,
    deriveFxRates,
    DEFAULT_FX,
    STARTING_CASH,
    DEFAULT_USDINR,
    type PaperState,
    type FxRates,
} from './paperEngine';
import type { LiveQuote } from '@/stores/marketStore';

function quote(symbol: string, price: number): LiveQuote {
    return {
        symbol, price, prevClose: price, change: 0, changePercent: 0,
        high: price, low: price, volume: 0, ts: 0, dir: null, real: true,
    };
}
const quotes = (m: Record<string, number>): Record<string, LiveQuote> =>
    Object.fromEntries(Object.entries(m).map(([s, p]) => [s, quote(s, p)]));

const FX: FxRates = { INR: 1, USD: 83.2, JPY: 83.2 / 156.82, stale: false };

function buy(state: PaperState, symbol: string, qty: number, price: number) {
    return placeOrder(state, { symbol, side: 'buy', type: 'market', qty }, quote(symbol, price), FX, 1);
}
function sell(state: PaperState, symbol: string, qty: number, price: number) {
    return placeOrder(state, { symbol, side: 'sell', type: 'market', qty }, quote(symbol, price), FX, 1);
}

// ---------------------------------------------------------------------------

describe('currency model', () => {
    it('knows each instrument’s quote currency', () => {
        expect(quoteCcyOf('BTC/USDT')).toBe('USD');
        expect(quoteCcyOf('RELIANCE')).toBe('INR');
        expect(quoteCcyOf('EUR/USD')).toBe('USD');
        expect(quoteCcyOf('USD/JPY')).toBe('JPY');
    });

    it('values USD/JPY in yen, not dollars', () => {
        // Regression: the old blanket USDINR rate valued 1 unit at 158.80 * 83.2 = ₹13,212.
        const inr = toBase('USD/JPY', 158.8, FX);
        expect(inr).toBeCloseTo(158.8 * (83.2 / 156.82), 6);
        expect(inr).toBeGreaterThan(70);
        expect(inr).toBeLessThan(100);
    });

    it('leaves INR-quoted instruments unconverted', () => {
        expect(toBase('RELIANCE', 2945.6, FX)).toBeCloseTo(2945.6, 6);
    });

    it('derives live rates and flags fallbacks as stale', () => {
        const live = deriveFxRates(quotes({ 'USD/INR': 90, 'USD/JPY': 150 }));
        expect(live.USD).toBe(90);
        expect(live.JPY).toBeCloseTo(90 / 150, 8);
        expect(live.stale).toBe(false);
        expect(deriveFxRates({}).USD).toBe(DEFAULT_USDINR);
        expect(deriveFxRates({}).stale).toBe(true);
    });
});

describe('ledger reconciliation', () => {
    it('holds for a fresh account', () => {
        assertReconciled(newPaperState());
    });

    it('holds through a long round trip', () => {
        let s = newPaperState();
        s = buy(s, 'BTC/USDT', 0.05, 65000).state;
        assertReconciled(s);
        s = sell(s, 'BTC/USDT', 0.05, 66000).state;
        assertReconciled(s);
        expect(Object.keys(s.positions)).toHaveLength(0);
        expect(realizedGross(s)).toBeGreaterThan(0);
        expect(realizedNet(s)).toBeCloseTo(realizedGross(s) - feesPaid(s), 8);
    });

    it('holds through a short round trip, and a short profits when price falls', () => {
        let s = newPaperState();
        s = sell(s, 'BTC/USDT', 0.05, 65000).state;
        assertReconciled(s);
        expect(s.positions['BTC/USDT'].qty).toBeLessThan(0);
        expect(s.positions['BTC/USDT'].marginHeldBase).toBeGreaterThan(0);

        s = buy(s, 'BTC/USDT', 0.05, 60000).state;
        assertReconciled(s);
        expect(realizedGross(s)).toBeGreaterThan(0);
    });

    it('holds through a position flip', () => {
        let s = newPaperState();
        s = buy(s, 'AAPL', 10, 200).state;
        s = sell(s, 'AAPL', 25, 210).state;
        assertReconciled(s);
        expect(s.positions.AAPL.qty).toBe(-15);
    });

    it('holds across a randomized order sequence', () => {
        // Deterministic pseudo-random walk of legal actions.
        let seed = 12345;
        const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
        let s = newPaperState();
        const syms = ['BTC/USDT', 'AAPL', 'RELIANCE', 'USD/JPY'];
        for (let i = 0; i < 300; i++) {
            const sym = syms[Math.floor(rnd() * syms.length)];
            const price = { 'BTC/USDT': 65000, AAPL: 200, RELIANCE: 2900, 'USD/JPY': 158 }[sym]!;
            const qty = sym === 'BTC/USDT' ? +(rnd() * 0.05).toFixed(4) : Math.ceil(rnd() * 5);
            const side = rnd() > 0.5 ? 'buy' : 'sell';
            s = placeOrder(s, { symbol: sym, side, type: 'market', qty }, quote(sym, price * (0.9 + rnd() * 0.2)), FX, i).state;
            expect(Math.abs(reconciliationError(s))).toBeLessThan(1e-6);
        }
    });
});

describe('buying power and validation', () => {
    it('rejects an order larger than the account', () => {
        const s = newPaperState();
        const { result, state } = buy(s, 'BTC/USDT', 100, 65000);
        expect(result.status).toBe('rejected');
        expect(result.reason).toMatch(/buying power/i);
        expect(state.orders[0].status).toBe('rejected');
        expect(state.orders[0].rejectReason).toBeTruthy();
        expect(state.account.cash).toBe(STARTING_CASH); // nothing moved
    });

    it('does NOT let a short increase buying power', () => {
        // Regression: opening a short used to credit full notional to cash.
        const before = newPaperState();
        const after = sell(before, 'BTC/USDT', 0.05, 65000).state;
        expect(buyingPower(after)).toBeLessThan(buyingPower(before));
        expect(after.account.cash).toBeLessThan(before.account.cash);
    });

    it('rejects zero, negative and non-finite quantities', () => {
        const s = newPaperState();
        for (const qty of [0, -1, NaN, Infinity]) {
            expect(buy(s, 'AAPL', qty, 200).result.status).toBe('rejected');
        }
    });

    it('rejects fractional quantities on whole-unit instruments', () => {
        const s = newPaperState();
        expect(buy(s, 'AAPL', 1.5, 200).result.status).toBe('rejected');
        expect(buy(s, 'BTC/USDT', 0.015, 65000).result.status).toBe('filled');
    });

    it('rejects an unknown instrument instead of resting forever', () => {
        const s = newPaperState();
        const { result } = placeOrder(s, { symbol: 'FAKECOIN', side: 'buy', type: 'market', qty: 1 }, undefined, FX, 0);
        expect(result.status).toBe('rejected');
        expect(result.reason).toMatch(/unknown instrument/i);
    });

    it('rejects limit and stop orders with no price', () => {
        const s = newPaperState();
        expect(placeOrder(s, { symbol: 'AAPL', side: 'buy', type: 'limit', qty: 1 }, quote('AAPL', 200), FX).result.status)
            .toBe('rejected');
        expect(placeOrder(s, { symbol: 'AAPL', side: 'buy', type: 'stop', qty: 1 }, quote('AAPL', 200), FX).result.status)
            .toBe('rejected');
    });

    it('always allows a pure reduction, even with no spare cash', () => {
        let s = newPaperState();
        s = buy(s, 'AAPL', 20, 200).state;
        s = { ...s, account: { ...s.account, cash: 0 } }; // drain cash
        expect(sell(s, 'AAPL', 20, 210).result.status).toBe('filled');
    });
});

describe('resting orders', () => {
    it('reserves cash so a second order cannot double-spend it', () => {
        let s = newPaperState();
        const big = Math.floor(STARTING_CASH / (200 * DEFAULT_FX.USD)) - 1;
        const first = placeOrder(s, { symbol: 'AAPL', side: 'buy', type: 'limit', qty: big, limitPrice: 200 }, quote('AAPL', 210), FX, 0);
        expect(first.result.status).toBe('accepted');
        s = first.state;
        expect(s.account.reservedCash).toBeGreaterThan(0);
        expect(buyingPower(s)).toBeLessThan(STARTING_CASH);

        const second = placeOrder(s, { symbol: 'AAPL', side: 'buy', type: 'limit', qty: big, limitPrice: 200 }, quote('AAPL', 210), FX, 0);
        expect(second.result.status).toBe('rejected');
    });

    it('releases the reservation on cancel', () => {
        let s = newPaperState();
        const { state, result } = placeOrder(s, { symbol: 'AAPL', side: 'buy', type: 'limit', qty: 5, limitPrice: 200 }, quote('AAPL', 210), FX, 0);
        s = cancelOrder(state, result.orderId, 1);
        expect(s.account.reservedCash).toBe(0);
        expect(buyingPower(s)).toBeCloseTo(STARTING_CASH, 6);
        assertReconciled(s);
    });

    it('fills a limit AT the limit price, never better', () => {
        let s = newPaperState();
        s = placeOrder(s, { symbol: 'AAPL', side: 'buy', type: 'limit', qty: 4, limitPrice: 200 }, quote('AAPL', 210), FX, 0).state;
        // Market trades well through the limit; the fill must still be at 200.
        s = processTick(s, quotes({ AAPL: 150 }), FX, 2);
        const fill = s.fills[0];
        expect(fill).toBeTruthy();
        expect(fill.price).toBe(200);
        assertReconciled(s);
    });

    it('fills a market order left resting on the next tick', () => {
        // Regression: processTick had no 'market' branch, so these rested forever.
        let s = newPaperState();
        const placed = placeOrder(s, { symbol: 'AAPL', side: 'buy', type: 'market', qty: 3 }, undefined, FX, 0);
        expect(placed.result.status).toBe('accepted');
        s = processTick(placed.state, quotes({ AAPL: 200 }), FX, 1);
        expect(s.orders[0].status).toBe('filled');
        assertReconciled(s);
    });

    it('partially fills fractional instruments instead of always filling 100%', () => {
        let s = newPaperState();
        s = placeOrder(s, { symbol: 'BTC/USDT', side: 'buy', type: 'limit', qty: 0.05, limitPrice: 65000 }, quote('BTC/USDT', 66000), FX, 0).state;
        s = processTick(s, quotes({ 'BTC/USDT': 64000 }), FX, 1);
        const order = s.orders.find((o) => o.type === 'limit')!;
        expect(order.filledQty).toBeGreaterThan(0);
        expect(order.filledQty).toBeLessThan(0.05);
        expect(order.status).toBe('partial');
        assertReconciled(s);
    });
});

describe('determinism', () => {
    it('produces byte-identical state for identical inputs', () => {
        const run = () => {
            let s = newPaperState(STARTING_CASH, 0);
            s = placeOrder(s, { symbol: 'BTC/USDT', side: 'buy', type: 'limit', qty: 0.05, limitPrice: 65000 }, quote('BTC/USDT', 66000), FX, 0).state;
            for (let i = 0; i < 6; i++) s = processTick(s, quotes({ 'BTC/USDT': 64000 }), FX, i);
            return JSON.stringify(s);
        };
        expect(run()).toBe(run());
    });
});

describe('aggregates survive the fills cap', () => {
    it('keeps realized P&L and win rate exact past the retention limit', () => {
        let s = newPaperState();
        for (let i = 0; i < 320; i++) {
            s = buy(s, 'AAPL', 1, 200).state;
            s = sell(s, 'AAPL', 1, 201).state;
        }
        expect(s.fills.length).toBeLessThanOrEqual(500);
        expect(s.fillsTruncated).toBe(true);
        // 320 closing fills, all winners.
        expect(s.account.roundTrips).toBe(320);
        expect(winRate(s)).toBe(100);
        expect(realizedGross(s)).toBeGreaterThan(0);
        assertReconciled(s);
    });

    it('retains per-symbol realized P&L after the position goes flat', () => {
        let s = newPaperState();
        s = buy(s, 'AAPL', 5, 200).state;
        s = sell(s, 'AAPL', 5, 210).state;
        expect(s.positions.AAPL).toBeUndefined();
        expect(s.realizedBySymbol.AAPL).toBeGreaterThan(0);
    });
});

describe('equity', () => {
    it('equals starting cash less fees when a short is marked at its own fill price', () => {
        let s = newPaperState();
        s = sell(s, 'BTC/USDT', 0.05, 65000).state;
        // Mark at the price actually filled, not the pre-slippage quote: a market sell
        // fills 3bps below, so marking back at 65000 correctly shows that slippage cost.
        const fillPrice = s.fills[0].price;
        expect(fillPrice).toBeLessThan(65000);
        expect(equity(s, quotes({ 'BTC/USDT': fillPrice }), FX)).toBeCloseTo(STARTING_CASH - feesPaid(s), 4);
        // Marked at the original quote, the position is down exactly the slippage.
        expect(equity(s, quotes({ 'BTC/USDT': 65000 }), FX)).toBeLessThan(STARTING_CASH - feesPaid(s));
    });

    it('rises when a short moves in your favour', () => {
        let s = newPaperState();
        s = sell(s, 'BTC/USDT', 0.05, 65000).state;
        const flat = equity(s, quotes({ 'BTC/USDT': 65000 }), FX);
        const better = equity(s, quotes({ 'BTC/USDT': 60000 }), FX);
        expect(better).toBeGreaterThan(flat);
    });
});
