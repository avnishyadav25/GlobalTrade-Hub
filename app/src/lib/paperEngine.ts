// Realistic paper-trading matching engine (pure functions).
//
// - market / limit / stop / stop-limit orders, resting orders, partial fills,
//   slippage, maker/taker fees, short margin, multi-currency accounting
// - DETERMINISTIC: no Math.random(), no Date.now() in the matching path. State is
//   persisted and cloud-synced, so two devices replaying the same inputs must agree.
//   Randomness for partial fills comes from a PRNG seeded by (orderId, filled, seq).
//
// ACCOUNTING MODEL
// Base currency is INR. Every instrument declares its own quote currency (see
// mockData.ts) and amounts are converted with `toBase`. The base cost of a position is
// frozen at fill time into `basisBase`, so a later FX move shows up as unrealized P&L
// and is realized on close — the standard total-return treatment.
//
// Opening a SHORT does not credit cash: it moves `basisBase * SHORT_MARGIN_FACTOR`
// from cash into `marginHeldBase`. Crediting the proceeds (the old behaviour) meant
// shorting increased buying power without bound.
//
// The ledger satisfies this identity at all times — see `assertReconciled`:
//
//   cash + Σ marginHeldBase + Σ_longs(basisBase)
//     === startingCash + realizedGross − feesPaid
//
// `reservedCash` is a soft hold on `cash` used for buying-power checks against resting
// orders; cash is not debited at reservation time, so it is not part of the identity.

import { getAsset, type Currency } from './mockData';
import { type Market } from './constants';
import type { LiveQuote } from '@/stores/marketStore';

export type PaperSide = 'buy' | 'sell';
export type PaperOrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type PaperOrderStatus = 'open' | 'partial' | 'filled' | 'cancelled' | 'rejected';

/** How a fill changed the position. The coach needs open-vs-close to detect revenge trades. */
export type FillKind = 'open' | 'add' | 'reduce' | 'close' | 'flip';

export const PAPER_STATE_VERSION = 2;

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
    /** Populated when status === 'rejected'. */
    rejectReason?: string;
    /** Base-currency cash held against this resting order; released on fill/cancel. */
    reservedBase: number;
}

export interface PaperFill {
    id: string;
    orderId: string;
    symbol: string;
    market: Market;
    side: PaperSide;
    kind: FillKind;
    qty: number;
    price: number;      // instrument quote currency
    fee: number;        // base currency (INR)
    pnl: number;        // realized, base currency, GROSS of this fill's fee
    ts: number;
}

export interface PaperPosition {
    symbol: string;
    market: Market;
    qty: number;          // signed: + long, - short (instrument units)
    avgPrice: number;     // quote currency
    /** Total base-currency cost of the open quantity, frozen at fill-time FX. */
    basisBase: number;
    /** Base-currency margin held against a short. Zero for longs. */
    marginHeldBase: number;
    realizedPnl: number;  // base currency, this position's lifetime
}

export interface PaperAccount {
    baseCurrency: 'INR';
    startingCash: number;
    cash: number;           // settled and spendable
    reservedCash: number;   // held against resting orders
    // Running aggregates. These are authoritative: `fills` is capped for display, so
    // reducing over it silently corrupted every total once the cap was reached.
    realizedGross: number;
    feesPaid: number;
    fillCount: number;
    roundTrips: number;
    roundTripWins: number;
}

export interface PaperState {
    version: number;
    account: PaperAccount;
    positions: Record<string, PaperPosition>;
    /** Realized P&L per symbol, retained after a position goes flat. */
    realizedBySymbol: Record<string, number>;
    orders: PaperOrder[];
    fills: PaperFill[];
    /** True when `fills` has been truncated, so the UI can say "showing last N of M". */
    fillsTruncated: boolean;
    /** Monotonic counter: deterministic ids and PRNG seeding. */
    seq: number;
    createdAt: number;
}

// ---- config ----
export const STARTING_CASH = 500000; // ₹5,00,000
export const MAX_FILLS_RETAINED = 500;
/** Fraction of a short's notional held as margin. 1.0 = fully covered. */
export const SHORT_MARGIN_FACTOR = 1.0;
/** Display-only margin requirement shown on the order ticket. */
const MARGIN_FACTOR = 0.2;
/** Slippage applied to taker (market/stop) fills. Limit fills are makers. */
export const TAKER_SLIPPAGE_BPS = 3;

/** Fees in basis points. Exported so the backtester charges the same. */
export const FEE_BPS_TAKER: Record<Market, number> = {
    crypto: 7.5,
    us: 1,
    india: 5,
    forex: 0.8,
    commodity: 2,
};
export const FEE_BPS_MAKER: Record<Market, number> = {
    crypto: 3,
    us: 0.5,
    india: 3,
    forex: 0.4,
    commodity: 1,
};

// ---- currency ----

/**
 * Fallback rates, used only until a live quote arrives — documented, not authoritative.
 *
 * These are a LAST RESORT: `/api/marketdata` supplies a live USD/INR (Yahoo, then
 * frankfurter.app, both keyless) and MarketEngine feeds it into the quote map. The
 * previous value here was 83.2 against a real rate of ~95.3, which mispriced every
 * USD-quoted position by 14.5%. Refresh these if they ever drift far again.
 */
export const DEFAULT_USDINR = 95.3;   // verified 2026-08-10
const DEFAULT_USDJPY = 156.82;

export interface FxRates {
    INR: number;
    USD: number;
    JPY: number;
    /** True when any leg fell back to a constant instead of a live quote. */
    stale: boolean;
}

export const DEFAULT_FX: FxRates = {
    INR: 1,
    USD: DEFAULT_USDINR,
    JPY: DEFAULT_USDINR / DEFAULT_USDJPY,
    stale: true,
};

/**
 * Build the currency->INR table from live quotes where possible.
 * USD/INR comes straight from the provider; JPY is derived as USDINR / USDJPY.
 */
export function deriveFxRates(quotes: Record<string, LiveQuote> | undefined): FxRates {
    const usdinr = quotes?.['USD/INR']?.price;
    const usdjpy = quotes?.['USD/JPY']?.price;
    const usd = Number.isFinite(usdinr) && (usdinr as number) > 0 ? (usdinr as number) : DEFAULT_USDINR;
    const jpyPerUsd = Number.isFinite(usdjpy) && (usdjpy as number) > 0 ? (usdjpy as number) : DEFAULT_USDJPY;
    return { INR: 1, USD: usd, JPY: usd / jpyPerUsd, stale: !usdinr || !usdjpy };
}

export function quoteCcyOf(symbol: string): Currency {
    const a = getAsset(symbol);
    if (a) return a.quoteCcy;
    // Unknown symbol: infer from the pair suffix rather than guessing USD blindly.
    const quote = symbol.includes('/') ? symbol.split('/')[1] : '';
    if (quote === 'JPY') return 'JPY';
    if (quote === 'INR') return 'INR';
    return 'USD';
}

/** Convert an amount expressed in an instrument's quote currency into INR. */
export function toBase(symbol: string, amountInQuoteCcy: number, fx: FxRates = DEFAULT_FX): number {
    return amountInQuoteCcy * fx[quoteCcyOf(symbol)];
}

/**
 * @deprecated Use `toBase`. Retained only so callers that multiply by a rate keep
 * working; it now returns the correct per-currency rate instead of a blanket USDINR.
 */
export function fxRate(symbol: string, fx: FxRates = DEFAULT_FX): number {
    return fx[quoteCcyOf(symbol)];
}

export function marketOf(symbol: string): Market {
    return getAsset(symbol)?.market ?? 'crypto';
}

export function isFractional(symbol: string): boolean {
    return getAsset(symbol)?.fractional ?? true;
}

function feeFor(symbol: string, notionalBase: number, maker: boolean): number {
    const m = marketOf(symbol);
    const table = maker ? FEE_BPS_MAKER : FEE_BPS_TAKER;
    return (Math.abs(notionalBase) * (table[m] ?? 2)) / 10000;
}

export function estimateCharges(symbol: string, qty: number, price: number, fx: FxRates = DEFAULT_FX) {
    const orderValue = toBase(symbol, qty * price, fx);
    return {
        orderValue,
        margin: orderValue * MARGIN_FACTOR,
        charges: feeFor(symbol, orderValue, false),
    };
}

// ---- deterministic PRNG ----

function hashStr(s: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

/** mulberry32 — small, fast, and reproducible across engines. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---- state ----

export function newPaperState(startingCash = STARTING_CASH, createdAt = 0): PaperState {
    return {
        version: PAPER_STATE_VERSION,
        account: {
            baseCurrency: 'INR',
            startingCash,
            cash: startingCash,
            reservedCash: 0,
            realizedGross: 0,
            feesPaid: 0,
            fillCount: 0,
            roundTrips: 0,
            roundTripWins: 0,
        },
        positions: {},
        realizedBySymbol: {},
        orders: [],
        fills: [],
        fillsTruncated: false,
        seq: 0,
        createdAt,
    };
}

// ---- position maths ----

interface ApplyResult {
    positions: Record<string, PaperPosition>;
    realized: number;
    kind: FillKind;
    /** Base cash delta from the position side alone (excludes fees). */
    cashDelta: number;
    /** Change in margin held (positive = more margin reserved). */
    marginDelta: number;
    closedQty: number;
}

/**
 * Apply a fill to a position and report the base-currency cash and margin movements.
 *
 * Booking rules:
 *   open/add long   cash -= notionalBase
 *   reduce long     cash += proceedsBase ; realized = proceeds − closedBasis
 *   open/add short  cash -= notionalBase * SHORT_MARGIN_FACTOR (moved to margin)
 *   reduce short    cash += releasedMargin + realized ; realized = closedBasis − proceeds
 */
function applyToPosition(
    positions: Record<string, PaperPosition>,
    symbol: string,
    side: PaperSide,
    qty: number,
    price: number,
    fx: FxRates
): ApplyResult {
    const dir = side === 'buy' ? 1 : -1;
    const signed = dir * qty;
    const notionalBase = toBase(symbol, qty * price, fx);
    const existing = positions[symbol];
    const next = { ...positions };

    // --- flat: open a new position ---
    if (!existing || existing.qty === 0) {
        const isShort = signed < 0;
        const margin = isShort ? notionalBase * SHORT_MARGIN_FACTOR : 0;
        next[symbol] = {
            symbol,
            market: marketOf(symbol),
            qty: signed,
            avgPrice: price,
            basisBase: notionalBase,
            marginHeldBase: margin,
            realizedPnl: 0,
        };
        return {
            positions: next,
            realized: 0,
            kind: 'open',
            cashDelta: isShort ? -margin : -notionalBase,
            marginDelta: margin,
            closedQty: 0,
        };
    }

    const posSign = Math.sign(existing.qty);
    const isShort = posSign < 0;

    // --- same direction: add to the position ---
    if (Math.sign(signed) === posSign) {
        const total = Math.abs(existing.qty) + qty;
        const margin = isShort ? notionalBase * SHORT_MARGIN_FACTOR : 0;
        next[symbol] = {
            ...existing,
            qty: round8(existing.qty + signed),
            avgPrice: (existing.avgPrice * Math.abs(existing.qty) + price * qty) / total,
            basisBase: existing.basisBase + notionalBase,
            marginHeldBase: existing.marginHeldBase + margin,
        };
        return {
            positions: next,
            realized: 0,
            kind: 'add',
            cashDelta: isShort ? -margin : -notionalBase,
            marginDelta: margin,
            closedQty: 0,
        };
    }

    // --- opposite direction: reduce, close, or flip ---
    const openQty = Math.abs(existing.qty);
    const closeQty = Math.min(qty, openQty);
    const frac = closeQty / openQty;
    const closedBasis = existing.basisBase * frac;
    const releasedMargin = existing.marginHeldBase * frac;
    const proceedsBase = toBase(symbol, closeQty * price, fx);

    const realized = isShort ? closedBasis - proceedsBase : proceedsBase - closedBasis;

    let cashDelta = isShort ? releasedMargin + realized : proceedsBase;
    let marginDelta = -releasedMargin;

    const newQty = round8(existing.qty + signed);
    const flipQty = qty - closeQty; // leftover opens a position the other way

    let kind: FillKind = newQty === 0 ? 'close' : 'reduce';

    if (flipQty > 1e-8) {
        kind = 'flip';
        const flipNotional = toBase(symbol, flipQty * price, fx);
        const flipIsShort = newQty < 0;
        const flipMargin = flipIsShort ? flipNotional * SHORT_MARGIN_FACTOR : 0;
        next[symbol] = {
            symbol,
            market: marketOf(symbol),
            qty: newQty,
            avgPrice: price,
            basisBase: flipNotional,
            marginHeldBase: flipMargin,
            realizedPnl: existing.realizedPnl + realized,
        };
        cashDelta += flipIsShort ? -flipMargin : -flipNotional;
        marginDelta += flipMargin;
    } else if (Math.abs(newQty) < 1e-8) {
        delete next[symbol];
    } else {
        next[symbol] = {
            ...existing,
            qty: newQty,
            basisBase: existing.basisBase - closedBasis,
            marginHeldBase: existing.marginHeldBase - releasedMargin,
            realizedPnl: existing.realizedPnl + realized,
        };
    }

    return { positions: next, realized, kind, cashDelta, marginDelta, closedQty: closeQty };
}

function round8(n: number): number {
    return Math.round(n * 1e8) / 1e8;
}

// ---- filling ----

function fillOrder(
    state: PaperState,
    order: PaperOrder,
    fillQty: number,
    fillPrice: number,
    maker: boolean,
    fx: FxRates,
    ts: number
): PaperState {
    if (!(fillQty > 1e-8) || !Number.isFinite(fillPrice) || fillPrice <= 0) return state;

    const notionalBase = toBase(order.symbol, fillQty * fillPrice, fx);
    const fee = feeFor(order.symbol, notionalBase, maker);
    const applied = applyToPosition(state.positions, order.symbol, order.side, fillQty, fillPrice, fx);

    const prevFilled = order.filledQty;
    const newFilled = round8(prevFilled + fillQty);
    const newAvg = (order.avgFillPrice * prevFilled + fillPrice * fillQty) / newFilled;

    // Release the reservation proportionally to what just filled.
    const releaseFrac = order.qty > 0 ? Math.min(1, fillQty / order.qty) : 1;
    const released = Math.min(order.reservedBase, order.reservedBase * releaseFrac);

    const seq = state.seq + 1;

    const fill: PaperFill = {
        id: `fill-${seq}`,
        orderId: order.id,
        symbol: order.symbol,
        market: order.market,
        side: order.side,
        kind: applied.kind,
        qty: fillQty,
        price: fillPrice,
        fee,
        pnl: applied.realized,
        ts,
    };

    const complete = newFilled >= order.qty - 1e-8;
    const updatedOrder: PaperOrder = {
        ...order,
        filledQty: newFilled,
        avgFillPrice: newAvg,
        fees: order.fees + fee,
        status: complete ? 'filled' : 'partial',
        reservedBase: complete ? 0 : Math.max(0, order.reservedBase - released),
        updatedAt: ts,
    };

    const fills = [fill, ...state.fills];
    const truncated = fills.length > MAX_FILLS_RETAINED;

    const isRoundTrip = applied.closedQty > 1e-8;

    return {
        ...state,
        seq,
        account: {
            ...state.account,
            cash: state.account.cash + applied.cashDelta - fee,
            reservedCash: Math.max(0, state.account.reservedCash - (complete ? order.reservedBase : released)),
            realizedGross: state.account.realizedGross + applied.realized,
            feesPaid: state.account.feesPaid + fee,
            fillCount: state.account.fillCount + 1,
            roundTrips: state.account.roundTrips + (isRoundTrip ? 1 : 0),
            roundTripWins: state.account.roundTripWins + (isRoundTrip && applied.realized > 0 ? 1 : 0),
        },
        positions: applied.positions,
        realizedBySymbol: isRoundTrip
            ? { ...state.realizedBySymbol, [order.symbol]: (state.realizedBySymbol[order.symbol] ?? 0) + applied.realized }
            : state.realizedBySymbol,
        orders: state.orders.map((o) => (o.id === order.id ? updatedOrder : o)),
        fills: fills.slice(0, MAX_FILLS_RETAINED),
        fillsTruncated: state.fillsTruncated || truncated,
    };
}

// ---- placing ----

export interface PlaceOrderInput {
    symbol: string;
    side: PaperSide;
    type: PaperOrderType;
    qty: number;
    limitPrice?: number;
    stopPrice?: number;
}

export type PlaceStatus = 'filled' | 'accepted' | 'rejected';

export interface PlaceResult {
    status: PlaceStatus;
    orderId: string;
    reason?: string;
}

/** Buying power = settled cash not already committed to resting orders. */
export function buyingPower(state: PaperState): number {
    return state.account.cash - state.account.reservedCash;
}

function validate(state: PaperState, input: PlaceOrderInput, refPrice: number, fx: FxRates): string | null {
    if (!getAsset(input.symbol)) return `Unknown instrument ${input.symbol}`;
    if (!Number.isFinite(input.qty) || input.qty <= 0) return 'Quantity must be greater than zero';
    if (!isFractional(input.symbol) && !Number.isInteger(input.qty)) {
        return `${input.symbol} trades in whole units`;
    }
    if (input.type === 'limit' || input.type === 'stop_limit') {
        if (!Number.isFinite(input.limitPrice) || (input.limitPrice as number) <= 0) {
            return 'Limit orders need a limit price';
        }
    }
    if (input.type === 'stop' || input.type === 'stop_limit') {
        if (!Number.isFinite(input.stopPrice) || (input.stopPrice as number) <= 0) {
            return 'Stop orders need a trigger price';
        }
    }
    if (!Number.isFinite(refPrice) || refPrice <= 0) return 'No price available for this instrument';

    const notionalBase = toBase(input.symbol, input.qty * refPrice, fx);
    const fee = feeFor(input.symbol, notionalBase, input.type !== 'market');
    const pos = state.positions[input.symbol];
    const posQty = pos?.qty ?? 0;
    const dir = input.side === 'buy' ? 1 : -1;

    // Quantity that would open or extend exposure (the part needing funding).
    const closing = Math.sign(posQty) !== 0 && Math.sign(dir) !== Math.sign(posQty)
        ? Math.min(input.qty, Math.abs(posQty))
        : 0;
    const openingQty = input.qty - closing;
    if (openingQty <= 1e-8) return null; // pure reduction always allowed

    const openingNotional = toBase(input.symbol, openingQty * refPrice, fx);
    const required = (input.side === 'buy' ? openingNotional : openingNotional * SHORT_MARGIN_FACTOR) + fee;

    if (required > buyingPower(state) + 1e-6) {
        return `Insufficient buying power: needs ₹${Math.round(required).toLocaleString('en-IN')}, have ₹${Math.round(buyingPower(state)).toLocaleString('en-IN')}`;
    }
    return null;
}

export function placeOrder(
    state: PaperState,
    input: PlaceOrderInput,
    quote?: LiveQuote,
    fx: FxRates = DEFAULT_FX,
    ts = 0
): { state: PaperState; result: PlaceResult } {
    const seq = state.seq + 1;
    const id = `ord-${seq}`;
    const asset = getAsset(input.symbol);
    const refPrice =
        input.type === 'limit' ? (input.limitPrice ?? quote?.price ?? asset?.price ?? 0) : (quote?.price ?? asset?.price ?? 0);

    const base: PaperOrder = {
        id,
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
        createdAt: ts,
        updatedAt: ts,
        reservedBase: 0,
    };

    const reason = validate(state, input, refPrice, fx);
    if (reason) {
        const rejected: PaperOrder = { ...base, status: 'rejected', rejectReason: reason };
        return {
            state: { ...state, seq, orders: [rejected, ...state.orders] },
            result: { status: 'rejected', orderId: id, reason },
        };
    }

    // Market orders fill immediately against the current quote.
    if (input.type === 'market' && quote) {
        const slip = 1 + (input.side === 'buy' ? 1 : -1) * (TAKER_SLIPPAGE_BPS / 10000);
        const withOrder: PaperState = { ...state, seq, orders: [base, ...state.orders] };
        const filled = fillOrder(withOrder, base, input.qty, quote.price * slip, false, fx, ts);
        return { state: filled, result: { status: 'filled', orderId: id } };
    }

    // Resting order: reserve the funding so it can't be double-spent by later orders.
    const notionalBase = toBase(input.symbol, input.qty * refPrice, fx);
    const reservedBase =
        input.side === 'buy' ? notionalBase : notionalBase * SHORT_MARGIN_FACTOR;
    const resting: PaperOrder = { ...base, reservedBase };

    return {
        state: {
            ...state,
            seq,
            account: { ...state.account, reservedCash: state.account.reservedCash + reservedBase },
            orders: [resting, ...state.orders],
        },
        result: { status: 'accepted', orderId: id },
    };
}

/**
 * Record an order that was refused BEFORE it reached the engine — by the kill-switch
 * or a coach rule. Those blocks previously returned `{status:'rejected', orderId:''}`
 * without persisting anything, so the user saw a transient toast and the Orders screen
 * showed nothing.
 *
 * Safe for the reconciliation identity: a rejected order carries `reservedBase: 0` and
 * never touches cash or positions.
 */
export function recordRejection(
    state: PaperState,
    input: PlaceOrderInput,
    reason: string,
    ts = 0
): { state: PaperState; result: PlaceResult } {
    const seq = state.seq + 1;
    const id = `ord-${seq}`;
    const order: PaperOrder = {
        id,
        symbol: input.symbol,
        market: marketOf(input.symbol),
        side: input.side,
        type: input.type,
        qty: input.qty,
        limitPrice: input.limitPrice,
        stopPrice: input.stopPrice,
        filledQty: 0,
        avgFillPrice: 0,
        status: 'rejected',
        rejectReason: reason,
        fees: 0,
        createdAt: ts,
        updatedAt: ts,
        reservedBase: 0,
    };
    return {
        state: { ...state, seq, orders: [order, ...state.orders] },
        result: { status: 'rejected', orderId: id, reason },
    };
}

/** Orders in a given status, newest first. */
export function ordersByStatus(state: PaperState, ...statuses: PaperOrderStatus[]): PaperOrder[] {
    const want = new Set(statuses);
    return state.orders.filter((o) => want.has(o.status));
}

/** Resting orders — the ones that can still fill or be cancelled. */
export function openOrders(state: PaperState): PaperOrder[] {
    return ordersByStatus(state, 'open', 'partial');
}

/** The fills that belong to one order, oldest first. */
export function fillsForOrder(state: PaperState, orderId: string): PaperFill[] {
    return state.fills.filter((f) => f.orderId === orderId).sort((a, b) => a.ts - b.ts);
}

export function cancelOrder(state: PaperState, orderId: string, ts = 0): PaperState {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order || (order.status !== 'open' && order.status !== 'partial')) return state;
    return {
        ...state,
        account: { ...state.account, reservedCash: Math.max(0, state.account.reservedCash - order.reservedBase) },
        orders: state.orders.map((o) =>
            o.id === orderId ? { ...o, status: 'cancelled', reservedBase: 0, updatedAt: ts } : o
        ),
    };
}

// ---- matching ----

/** Evaluate resting orders against current quotes. Deterministic given its inputs. */
export function processTick(
    state: PaperState,
    quotes: Record<string, LiveQuote>,
    fx: FxRates = DEFAULT_FX,
    ts = 0
): PaperState {
    let next = state;
    const resting = state.orders.filter((o) => o.status === 'open' || o.status === 'partial');

    for (const o of resting) {
        const q = quotes[o.symbol];
        if (!q || !Number.isFinite(q.price) || q.price <= 0) continue;

        const current = next.orders.find((x) => x.id === o.id);
        if (!current || (current.status !== 'open' && current.status !== 'partial')) continue;

        const remaining = round8(current.qty - current.filledQty);
        if (remaining <= 1e-8) continue;

        const price = q.price;
        const slip = 1 + (o.side === 'buy' ? 1 : -1) * (TAKER_SLIPPAGE_BPS / 10000);

        let triggered = false;
        let fillPrice = price;
        let maker = false;

        if (o.type === 'market') {
            // A market order that could not fill at placement (no quote yet) fills on the
            // next tick rather than resting forever, which is what used to happen.
            triggered = true;
            fillPrice = price * slip;
        } else if (o.type === 'limit') {
            if (o.limitPrice != null) {
                const crossed = o.side === 'buy' ? price <= o.limitPrice : price >= o.limitPrice;
                if (crossed) {
                    triggered = true;
                    maker = true;
                    // Fill AT the limit, not at the better market price: a resting limit
                    // does not get price improvement in this model.
                    fillPrice = o.limitPrice;
                }
            }
        } else if (o.type === 'stop') {
            const hit =
                o.stopPrice != null &&
                ((o.side === 'buy' && price >= o.stopPrice) || (o.side === 'sell' && price <= o.stopPrice));
            if (hit) {
                triggered = true;
                fillPrice = price * slip;
            }
        } else if (o.type === 'stop_limit') {
            if (!current.stopTriggered) {
                const hit =
                    o.stopPrice != null &&
                    ((o.side === 'buy' && price >= o.stopPrice) || (o.side === 'sell' && price <= o.stopPrice));
                if (hit) {
                    next = { ...next, orders: next.orders.map((x) => (x.id === o.id ? { ...x, stopTriggered: true } : x)) };
                }
                continue;
            }
            if (o.limitPrice != null) {
                const crossed = o.side === 'buy' ? price <= o.limitPrice : price >= o.limitPrice;
                if (crossed) {
                    triggered = true;
                    maker = true;
                    fillPrice = o.limitPrice;
                }
            }
        }

        if (!triggered) continue;

        // Deterministic partial fills, seeded from immutable order facts plus seq so two
        // ticks in the same millisecond don't produce identical fractions.
        const rnd = mulberry32(hashStr(`${o.id}:${current.filledQty}:${next.seq}`));
        const frac = 0.4 + rnd() * 0.6;
        let fillQty: number;
        if (o.type === 'market') {
            fillQty = remaining;
        } else if (isFractional(o.symbol)) {
            fillQty = round8(remaining * frac);
        } else {
            // Whole-unit instruments: at least one unit, never more than what is left.
            fillQty = Math.min(remaining, Math.max(1, Math.floor(remaining * frac)));
        }
        if (!(fillQty > 1e-8)) continue;

        const fresh = next.orders.find((x) => x.id === o.id);
        if (!fresh) continue;
        next = fillOrder(next, fresh, fillQty, fillPrice, maker, fx, ts);
    }
    return next;
}

// ---- derived selectors ----

export function positionMarketValueBase(pos: PaperPosition, quotes: Record<string, LiveQuote>, fx: FxRates = DEFAULT_FX): number {
    const price = quotes[pos.symbol]?.price ?? pos.avgPrice;
    return toBase(pos.symbol, pos.qty * price, fx);
}

export function unrealizedPnlBase(pos: PaperPosition, quotes: Record<string, LiveQuote>, fx: FxRates = DEFAULT_FX): number {
    const price = quotes[pos.symbol]?.price ?? pos.avgPrice;
    const marketValue = toBase(pos.symbol, Math.abs(pos.qty) * price, fx);
    // basisBase is the frozen entry cost; longs gain when value rises, shorts when it falls.
    return pos.qty >= 0 ? marketValue - pos.basisBase : pos.basisBase - marketValue;
}

export function equity(state: PaperState, quotes: Record<string, LiveQuote>, fx: FxRates = DEFAULT_FX): number {
    // `reservedCash` is a soft hold on `cash`, not a separate pot — cash is never
    // debited at reservation time — so adding it here would double-count.
    let total = state.account.cash;
    for (const p of Object.values(state.positions)) {
        total += p.marginHeldBase;
        total += p.qty >= 0 ? positionMarketValueBase(p, quotes, fx) : unrealizedPnlBase(p, quotes, fx);
    }
    return total;
}

export function openUnrealized(state: PaperState, quotes: Record<string, LiveQuote>, fx: FxRates = DEFAULT_FX): number {
    let u = 0;
    for (const p of Object.values(state.positions)) u += unrealizedPnlBase(p, quotes, fx);
    return u;
}

/** Realized P&L before fees. */
export function realizedGross(state: PaperState): number {
    return state.account.realizedGross;
}

/** All fees charged to the account. */
export function feesPaid(state: PaperState): number {
    return state.account.feesPaid;
}

/** Realized P&L after fees — this is the figure that reconciles with cash. */
export function realizedNet(state: PaperState): number {
    return state.account.realizedGross - state.account.feesPaid;
}

/** Realized net P&L for fills at or after `since` (defaults to all time). */
export function realizedNetSince(state: PaperState, since: number): number {
    let net = 0;
    for (const f of state.fills) {
        if (f.ts >= since) net += f.pnl - f.fee;
    }
    return net;
}

/** Win rate over ROUND TRIPS, not fills — a 4-way partial exit is one trade. */
export function winRate(state: PaperState): number {
    const { roundTrips, roundTripWins } = state.account;
    return roundTrips ? (roundTripWins / roundTrips) * 100 : 0;
}

export function roundTrips(state: PaperState): number {
    return state.account.roundTrips;
}

// ---- invariant ----

/**
 * The ledger identity. Any violation means cash and realized P&L have diverged,
 * which is the class of bug that made the old engine's numbers unreconcilable.
 */
export function reconciliationError(state: PaperState): number {
    // `reservedCash` is deliberately absent: it is a soft hold on `cash` (which is not
    // debited at reservation time), so counting it here would double-count.
    let lhs = state.account.cash;
    for (const p of Object.values(state.positions)) {
        lhs += p.marginHeldBase;
        if (p.qty > 0) lhs += p.basisBase;
    }
    const rhs = state.account.startingCash + state.account.realizedGross - state.account.feesPaid;
    return lhs - rhs;
}

export function assertReconciled(state: PaperState, tolerance = 1e-6): void {
    const err = reconciliationError(state);
    if (Math.abs(err) > tolerance) {
        throw new Error(`Paper ledger does not reconcile: off by ${err}`);
    }
}

// ---- migration ----

/**
 * Bring a persisted blob up to the current shape.
 *
 * v1 -> v2 is NOT migratable: every historical fill's P&L was computed with a blanket
 * USD->INR rate applied to non-USD instruments, so the book mixes currency conventions
 * and can never satisfy the reconciliation identity. We reset rather than carry numbers
 * forward that are known to be wrong. Callers should tell the user this happened.
 */
export function migratePaperState(raw: unknown): { state: PaperState; reset: boolean } {
    if (!raw || typeof raw !== 'object') return { state: newPaperState(), reset: false };
    const s = raw as Partial<PaperState>;
    if (s.version === PAPER_STATE_VERSION && s.account && s.positions && Array.isArray(s.orders)) {
        return { state: s as PaperState, reset: false };
    }
    const startingCash = (s.account as PaperAccount | undefined)?.startingCash ?? STARTING_CASH;
    return { state: newPaperState(startingCash), reset: true };
}

/** Shape check used by cloudSync before writing server JSON into the store. */
export function isPaperState(value: unknown): value is PaperState {
    if (!value || typeof value !== 'object') return false;
    const s = value as Partial<PaperState>;
    return (
        s.version === PAPER_STATE_VERSION &&
        !!s.account &&
        typeof s.account.cash === 'number' &&
        Number.isFinite(s.account.cash) &&
        typeof s.account.startingCash === 'number' &&
        !!s.positions &&
        typeof s.positions === 'object' &&
        Array.isArray(s.orders) &&
        Array.isArray(s.fills) &&
        typeof s.seq === 'number'
    );
}
