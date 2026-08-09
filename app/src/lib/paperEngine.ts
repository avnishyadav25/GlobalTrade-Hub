// Realistic paper-trading matching engine (pure functions).
// - market / limit / stop / stop-limit orders
// - resting orders, partial fills, slippage, fees, multi-currency account
// - priced against live quotes; deterministic given its inputs (no globals)

import { getAsset } from './mockData';
import { type Market } from './constants';
import type { LiveQuote } from '@/stores/marketStore';

export type PaperSide = 'buy' | 'sell';
export type PaperOrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type PaperOrderStatus = 'open' | 'partial' | 'filled' | 'cancelled' | 'rejected';

export interface PaperOrder {
    id: string;
    symbol: string;
    market: Market;
    side: PaperSide;
    type: PaperOrderType;
    qty: number;
    limitPrice?: number;
    stopPrice?: number;
    filledQty: number;
    avgFillPrice: number;
    status: PaperOrderStatus;
    fees: number;
    createdAt: number;
    updatedAt: number;
    stopTriggered?: boolean;
}

export interface PaperFill {
    id: string;
    orderId: string;
    symbol: string;
    market: Market;
    side: PaperSide;
    qty: number;
    price: number;      // in instrument currency
    fee: number;        // in base currency (INR)
    pnl: number;        // realized, base currency
    ts: number;
}

export interface PaperPosition {
    symbol: string;
    market: Market;
    qty: number;        // signed: + long, - short (instrument units)
    avgPrice: number;   // instrument currency
    realizedPnl: number; // base currency
}

export interface PaperAccount {
    baseCurrency: 'INR';
    cash: number;        // base currency
    startingCash: number;
}

export interface PaperState {
    account: PaperAccount;
    positions: Record<string, PaperPosition>;
    orders: PaperOrder[];
    fills: PaperFill[];
    createdAt: number;
}

// ---- config ----
export const USDINR = 83.2;
export const STARTING_CASH = 500000; // ₹5,00,000 (matches AxisOne paper start)
const FEE_BPS: Record<Market, number> = {
    crypto: 7.5,
    us: 1,
    india: 5,
    forex: 0.8,
    commodity: 2,
};
const MARKET_SLIPPAGE_BPS = 3; // for market/stop fills
const MARGIN_FACTOR = 0.2;     // display-only margin requirement

export function fxRate(symbol: string): number {
    const a = getAsset(symbol);
    return a?.market === 'india' ? 1 : USDINR;
}

export function marketOf(symbol: string): Market {
    return getAsset(symbol)?.market ?? 'crypto';
}

function feeFor(symbol: string, notionalBase: number): number {
    const m = marketOf(symbol);
    return (notionalBase * (FEE_BPS[m] ?? 2)) / 10000;
}

export function estimateCharges(symbol: string, qty: number, price: number) {
    const fx = fxRate(symbol);
    const orderValue = qty * price * fx;
    return {
        orderValue,
        margin: orderValue * MARGIN_FACTOR,
        charges: feeFor(symbol, orderValue),
    };
}

export function newPaperState(startingCash = STARTING_CASH): PaperState {
    return {
        account: { baseCurrency: 'INR', cash: startingCash, startingCash },
        positions: {},
        orders: [],
        fills: [],
        createdAt: Date.now(),
    };
}

let _seq = 0;
function uid(prefix: string): string {
    _seq = (_seq + 1) % 1e6;
    return `${prefix}-${Date.now().toString(36)}-${_seq}`;
}

// Apply a fill to a position; returns realized pnl (base ccy) and mutates a copy.
function applyToPosition(
    positions: Record<string, PaperPosition>,
    symbol: string,
    side: PaperSide,
    qty: number,
    price: number
): { positions: Record<string, PaperPosition>; realized: number } {
    const fx = fxRate(symbol);
    const dir = side === 'buy' ? 1 : -1;
    const signed = dir * qty;
    const existing = positions[symbol];
    let realized = 0;

    if (!existing || existing.qty === 0) {
        positions = {
            ...positions,
            [symbol]: { symbol, market: marketOf(symbol), qty: signed, avgPrice: price, realizedPnl: 0 },
        };
        return { positions, realized };
    }

    const posSign = Math.sign(existing.qty);
    let newQty = existing.qty;
    let newAvg = existing.avgPrice;

    if (Math.sign(signed) === posSign) {
        // adding to position → weighted average
        const total = Math.abs(existing.qty) + qty;
        newAvg = (existing.avgPrice * Math.abs(existing.qty) + price * qty) / total;
        newQty = existing.qty + signed;
    } else {
        // reducing / closing / flipping
        const closeQty = Math.min(qty, Math.abs(existing.qty));
        realized = (price - existing.avgPrice) * closeQty * posSign * fx;
        newQty = existing.qty + signed;
        if (Math.sign(newQty) !== posSign && newQty !== 0) {
            // flipped: leftover opens new position at fill price
            newAvg = price;
        } else if (newQty === 0) {
            newAvg = 0;
        }
        // partial close keeps avg
    }

    const updated: PaperPosition = {
        symbol,
        market: marketOf(symbol),
        qty: +newQty.toFixed(8),
        avgPrice: newAvg,
        realizedPnl: existing.realizedPnl + realized,
    };
    positions = { ...positions };
    if (Math.abs(updated.qty) < 1e-8) delete positions[symbol];
    else positions[symbol] = updated;
    return { positions, realized };
}

function fillOrder(
    state: PaperState,
    order: PaperOrder,
    fillQty: number,
    fillPrice: number
): PaperState {
    const fx = fxRate(order.symbol);
    const notionalBase = fillQty * fillPrice * fx;
    const fee = feeFor(order.symbol, notionalBase);
    const { positions, realized } = applyToPosition(state.positions, order.symbol, order.side, fillQty, fillPrice);

    // signed cash flow: buy reduces cash, sell increases; fees always reduce
    const dir = order.side === 'buy' ? 1 : -1;
    const cashDelta = -dir * notionalBase - fee;

    const prevFilled = order.filledQty;
    const newFilled = prevFilled + fillQty;
    const newAvg = (order.avgFillPrice * prevFilled + fillPrice * fillQty) / newFilled;

    const fill: PaperFill = {
        id: uid('fill'),
        orderId: order.id,
        symbol: order.symbol,
        market: order.market,
        side: order.side,
        qty: fillQty,
        price: fillPrice,
        fee,
        pnl: realized,
        ts: Date.now(),
    };

    const updatedOrder: PaperOrder = {
        ...order,
        filledQty: +newFilled.toFixed(8),
        avgFillPrice: newAvg,
        fees: order.fees + fee,
        status: newFilled >= order.qty - 1e-8 ? 'filled' : 'partial',
        updatedAt: Date.now(),
    };

    return {
        ...state,
        account: { ...state.account, cash: state.account.cash + cashDelta },
        positions,
        orders: state.orders.map((o) => (o.id === order.id ? updatedOrder : o)),
        fills: [fill, ...state.fills].slice(0, 300),
    };
}

export interface PlaceOrderInput {
    symbol: string;
    side: PaperSide;
    type: PaperOrderType;
    qty: number;
    limitPrice?: number;
    stopPrice?: number;
}

export function placeOrder(state: PaperState, input: PlaceOrderInput, quote?: LiveQuote): PaperState {
    const order: PaperOrder = {
        id: uid('ord'),
        symbol: input.symbol,
        market: marketOf(input.symbol),
        side: input.side,
        type: input.type,
        qty: input.qty,
        limitPrice: input.limitPrice,
        stopPrice: input.stopPrice,
        filledQty: 0,
        avgFillPrice: 0,
        status: 'open',
        fees: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    let next: PaperState = { ...state, orders: [order, ...state.orders] };

    if (input.type === 'market' && quote) {
        const slip = 1 + (input.side === 'buy' ? 1 : -1) * (MARKET_SLIPPAGE_BPS / 10000);
        next = fillOrder(next, order, order.qty, quote.price * slip);
    }
    return next;
}

export function cancelOrder(state: PaperState, orderId: string): PaperState {
    return {
        ...state,
        orders: state.orders.map((o) =>
            o.id === orderId && (o.status === 'open' || o.status === 'partial')
                ? { ...o, status: 'cancelled', updatedAt: Date.now() }
                : o
        ),
    };
}

// Evaluate resting orders against current quotes; returns a new state.
export function processTick(state: PaperState, quotes: Record<string, LiveQuote>): PaperState {
    let next = state;
    const resting = state.orders.filter((o) => o.status === 'open' || o.status === 'partial');
    for (const o of resting) {
        const q = quotes[o.symbol];
        if (!q) continue;
        const remaining = o.qty - o.filledQty;
        if (remaining <= 1e-8) continue;
        const price = q.price;
        const slip = 1 + (o.side === 'buy' ? 1 : -1) * (MARKET_SLIPPAGE_BPS / 10000);

        let triggered = false;
        let fillPrice = price;

        if (o.type === 'limit') {
            if (o.limitPrice != null) {
                if (o.side === 'buy' && price <= o.limitPrice) { triggered = true; fillPrice = Math.min(price, o.limitPrice); }
                if (o.side === 'sell' && price >= o.limitPrice) { triggered = true; fillPrice = Math.max(price, o.limitPrice); }
            }
        } else if (o.type === 'stop') {
            const hit = o.stopPrice != null && ((o.side === 'buy' && price >= o.stopPrice) || (o.side === 'sell' && price <= o.stopPrice));
            if (hit) { triggered = true; fillPrice = price * slip; }
        } else if (o.type === 'stop_limit') {
            if (!o.stopTriggered) {
                const hit = o.stopPrice != null && ((o.side === 'buy' && price >= o.stopPrice) || (o.side === 'sell' && price <= o.stopPrice));
                if (hit) {
                    next = { ...next, orders: next.orders.map((x) => (x.id === o.id ? { ...x, stopTriggered: true } : x)) };
                }
                continue;
            } else if (o.limitPrice != null) {
                if (o.side === 'buy' && price <= o.limitPrice) { triggered = true; fillPrice = Math.min(price, o.limitPrice); }
                if (o.side === 'sell' && price >= o.limitPrice) { triggered = true; fillPrice = Math.max(price, o.limitPrice); }
            }
        }

        if (triggered) {
            // partial fills: fill 40-100% of remaining per tick
            const frac = 0.4 + Math.random() * 0.6;
            const fillQty = o.type === 'market' ? remaining : Math.min(remaining, Math.max(remaining * frac, remaining < 1 ? remaining : 1));
            const current = next.orders.find((x) => x.id === o.id)!;
            next = fillOrder(next, current, +fillQty.toFixed(8), fillPrice);
        }
    }
    return next;
}

// ---- derived selectors ----
export function positionMarketValueBase(pos: PaperPosition, quotes: Record<string, LiveQuote>): number {
    const q = quotes[pos.symbol];
    const price = q?.price ?? pos.avgPrice;
    return pos.qty * price * fxRate(pos.symbol);
}

export function unrealizedPnlBase(pos: PaperPosition, quotes: Record<string, LiveQuote>): number {
    const q = quotes[pos.symbol];
    const price = q?.price ?? pos.avgPrice;
    return (price - pos.avgPrice) * pos.qty * fxRate(pos.symbol);
}

export function equity(state: PaperState, quotes: Record<string, LiveQuote>): number {
    let mv = 0;
    for (const p of Object.values(state.positions)) mv += positionMarketValueBase(p, quotes);
    return state.account.cash + mv;
}

export function openUnrealized(state: PaperState, quotes: Record<string, LiveQuote>): number {
    let u = 0;
    for (const p of Object.values(state.positions)) u += unrealizedPnlBase(p, quotes);
    return u;
}

export function realizedTotal(state: PaperState): number {
    return state.fills.reduce((a, f) => a + f.pnl, 0);
}

export function winRate(state: PaperState): number {
    const closes = state.fills.filter((f) => f.pnl !== 0);
    if (!closes.length) return 0;
    return (closes.filter((f) => f.pnl > 0).length / closes.length) * 100;
}
