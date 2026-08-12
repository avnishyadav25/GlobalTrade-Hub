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

import { chargesFor, chargeTotal, type Product } from './charges';
import { isWholeLots } from './options/contract';
import { shortOptionMargin } from './options/margin';
import { getAsset, type Currency } from './mockData';
import { type Market } from './constants';
import type { LiveQuote } from '@/stores/marketStore';

export type PaperSide = 'buy' | 'sell';
export type PaperOrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type PaperOrderStatus = 'open' | 'partial' | 'filled' | 'cancelled' | 'rejected';

/** How a fill changed the position. The coach needs open-vs-close to detect revenge trades. */
export type FillKind = 'open' | 'add' | 'reduce' | 'close' | 'flip' | 'settle';

/** How the legs of a group relate to each other. */
export type OrderGroupKind = 'multileg' | 'oco' | 'bracket';

export const PAPER_STATE_VERSION = 2;

/**
 * Oldest shape this build can carry forward without discarding the book.
 *
 * v1 and below are genuinely unmigratable: fills were priced with a blanket USD→INR rate
 * applied to every non-India instrument, so the ledger can never reconcile. Everything
 * from v2 on is additive-optional and loads as-is.
 */
export const MIN_COMPATIBLE_PAPER_VERSION = 2;

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

    /* ---- group membership. All optional: an order without them is a singleton, which
       is exactly what every order was before multi-leg existed. ---- */

    /** Orders placed as one structure share this. `grp-<seq>`. */
    groupId?: string;
    /** Position within the group, in placement order. */
    legIndex?: number;
    groupKind?: OrderGroupKind;
    /** Bracket child: the order whose fill arms and sizes it. */
    parentId?: string;
    /**
     * Bracket child, inert until its parent fills.
     *
     * `false` means "waiting"; absent means "not a child" and rests normally. The
     * distinction matters — `!armed` would freeze every ordinary order ever placed.
     */
    armed?: boolean;
    /**
     * May only reduce an existing position, and reserves NOTHING.
     *
     * `validate` already short-circuits a pure reduction, so reserving against an exit
     * was always a hold with no purpose — and for a bracket pair it is a double hold
     * that can make the structure reject itself.
     */
    reduceOnly?: boolean;
    /** Engine-generated at expiry rather than placed by anyone. */
    origin?: 'user' | 'settlement';
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
    /**
     * Base-currency cash CREDITED when this position was opened.
     *
     * Nonzero only for a written option, which pays you a premium AND requires margin.
     * Short STOCK credits nothing here — its proceeds are held as margin instead (see
     * SHORT_MARGIN_FACTOR), so this is 0 and the ledger identity is unchanged for every
     * position that existed before options.
     *
     * STORED rather than derived from the symbol: deriving it would consult the module-
     * global instrument registry, which is empty on the server and empty before
     * rehydrate, so a reconciliation assert would flip based on registry timing. An
     * assert that depends on load order is worse than no assert.
     */
    creditBase?: number;
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

/**
 * The paper book is modelled as an INTRADAY product.
 *
 * It matters: Indian equity pays STT of 0.025% on the sell leg only when intraday, but
 * 0.1% on BOTH legs when held for delivery — four times the rate, twice over. Assuming
 * the cheaper of the two is the honest default for a simulator whose positions are
 * usually opened and closed in a session, and it is stated rather than hidden.
 */
const PAPER_PRODUCT = 'intraday';

/**
 * Which charge schedule applies to this instrument.
 *
 * Options are charged completely differently from equity: a flat ₹20 rather than a
 * capped percentage, STT ten times the intraday rate but on PREMIUM rather than
 * turnover, and an exchange fee about seventeen times higher. Routing on the contract
 * rather than on the market keeps `Market` free of a derivatives member, which would
 * otherwise ripple through every Record<Market, …> in the app.
 */
function productFor(symbol: string, settling = false): Product {
    if (!getAsset(symbol)?.contract) return PAPER_PRODUCT;
    return settling ? 'options-settlement' : 'options';
}

/**
 * Margin to post when WRITING an option, or undefined for anything else.
 *
 * Undefined is the signal to `applyToPosition` to use the cash-covered stock model, so
 * every non-option path is unchanged. A written option instead credits its premium and
 * posts this figure, which is why the two cannot share one formula.
 *
 * Returns undefined when no underlying mark is available. That deliberately falls back
 * to the conservative cash-covered model rather than guessing a spot price — a margin
 * computed from an invented underlying would look authoritative and be wrong.
 */
function shortMarginFor(
    symbol: string,
    side: PaperSide,
    qty: number,
    price: number,
    fx: FxRates,
    marks: Record<string, number>
): number | undefined {
    if (side !== 'sell') return undefined;
    const contract = getAsset(symbol)?.contract;
    if (!contract) return undefined;

    const spot = marks[contract.underlying];
    if (!Number.isFinite(spot) || spot <= 0) return undefined;

    const quote = shortOptionMargin(contract, spot, price, qty);
    return toBase(symbol, quote.marginBase, fx);
}

/** Spot marks by symbol, for sizing option margin. Derived, never stored. */
function marksFrom(quotes: Record<string, LiveQuote>): Record<string, number> {
    const marks: Record<string, number> = {};
    for (const [symbol, q] of Object.entries(quotes)) {
        if (q && Number.isFinite(q.price) && q.price > 0) marks[symbol] = q.price;
    }
    return marks;
}

function feeFor(
    symbol: string,
    notionalBase: number,
    maker: boolean,
    side: PaperSide,
    qty?: number,
    chargeBrokerage = true
): number {
    return chargeTotal({
        market: marketOf(symbol),
        side,
        product: productFor(symbol),
        notionalBase,
        maker,
        qty,
        chargeBrokerage,
    });
}

export function estimateCharges(
    symbol: string,
    qty: number,
    price: number,
    fx: FxRates = DEFAULT_FX,
    side: PaperSide = 'buy'
) {
    const orderValue = toBase(symbol, qty * price, fx);
    const breakdown = chargesFor({
        market: marketOf(symbol),
        side,
        product: PAPER_PRODUCT,
        notionalBase: orderValue,
        maker: false,
        qty,
    });
    return {
        orderValue,
        margin: orderValue * MARGIN_FACTOR,
        charges: breakdown.total,
        /** Itemised — brokerage, STT, stamp duty, GST and the rest, separately. */
        breakdown,
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
 *   open/add long    cash -= notionalBase
 *   reduce long      cash += proceedsBase ; realized = proceeds − closedBasis
 *   open/add short   cash -= notionalBase * SHORT_MARGIN_FACTOR (moved to margin)
 *   reduce short     cash += releasedMargin + realized − closedCredit
 *
 * WRITTEN OPTIONS take the same path with `shortMarginBase` supplied. A written option
 * CREDITS its premium to cash and posts a margin unrelated to that premium, where short
 * stock debits its notional straight into margin. Passing the margin in is the whole
 * difference — `creditBase` then carries the premium so the ledger identity can net it
 * back out, and the reduce formula covers both because `closedCredit` is 0 for stock.
 */
function applyToPosition(
    positions: Record<string, PaperPosition>,
    symbol: string,
    side: PaperSide,
    qty: number,
    price: number,
    fx: FxRates,
    /** Margin to post when opening a SHORT. Absent means the cash-covered stock model. */
    shortMarginBase?: number
): ApplyResult {
    const dir = side === 'buy' ? 1 : -1;
    const signed = dir * qty;
    const notionalBase = toBase(symbol, qty * price, fx);
    const existing = positions[symbol];
    const next = { ...positions };

    // --- flat: open a new position ---
    if (!existing || existing.qty === 0) {
        const isShort = signed < 0;
        const premiumModel = isShort && shortMarginBase !== undefined;
        const margin = isShort ? (premiumModel ? shortMarginBase : notionalBase * SHORT_MARGIN_FACTOR) : 0;
        const credit = premiumModel ? notionalBase : 0;
        next[symbol] = {
            symbol,
            market: marketOf(symbol),
            qty: signed,
            avgPrice: price,
            basisBase: notionalBase,
            marginHeldBase: margin,
            ...(credit > 0 ? { creditBase: credit } : {}),
            realizedPnl: 0,
        };
        return {
            positions: next,
            realized: 0,
            kind: 'open',
            // credit − margin. For stock credit is 0, so this stays exactly −margin.
            cashDelta: isShort ? credit - margin : -notionalBase,
            marginDelta: margin,
            closedQty: 0,
        };
    }

    const posSign = Math.sign(existing.qty);
    const isShort = posSign < 0;

    // --- same direction: add to the position ---
    if (Math.sign(signed) === posSign) {
        const total = Math.abs(existing.qty) + qty;
        const premiumModel = isShort && shortMarginBase !== undefined;
        const margin = isShort ? (premiumModel ? shortMarginBase : notionalBase * SHORT_MARGIN_FACTOR) : 0;
        const credit = premiumModel ? notionalBase : 0;
        const nextCredit = (existing.creditBase ?? 0) + credit;
        next[symbol] = {
            ...existing,
            qty: round8(existing.qty + signed),
            avgPrice: (existing.avgPrice * Math.abs(existing.qty) + price * qty) / total,
            basisBase: existing.basisBase + notionalBase,
            marginHeldBase: existing.marginHeldBase + margin,
            ...(nextCredit > 0 ? { creditBase: nextCredit } : {}),
        };
        return {
            positions: next,
            realized: 0,
            kind: 'add',
            cashDelta: isShort ? credit - margin : -notionalBase,
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
    const closedCredit = (existing.creditBase ?? 0) * frac;
    const proceedsBase = toBase(symbol, closeQty * price, fx);

    const realized = isShort ? closedBasis - proceedsBase : proceedsBase - closedBasis;

    // One formula covers both short models. Stock has closedCredit 0, giving exactly
    // today's `releasedMargin + realized`; a written option has closedCredit ===
    // closedBasis, which reduces to `releasedMargin − proceedsBase` — the cash you pay
    // to buy the option back, plus the margin you get released.
    let cashDelta = isShort ? releasedMargin + realized - closedCredit : proceedsBase;
    let marginDelta = -releasedMargin;

    const newQty = round8(existing.qty + signed);
    const flipQty = qty - closeQty; // leftover opens a position the other way

    let kind: FillKind = newQty === 0 ? 'close' : 'reduce';

    if (flipQty > 1e-8) {
        kind = 'flip';
        const flipNotional = toBase(symbol, flipQty * price, fx);
        const flipIsShort = newQty < 0;
        const flipPremiumModel = flipIsShort && shortMarginBase !== undefined;
        // shortMarginBase was sized for the whole order; the flip opens only the
        // leftover, so scale it rather than posting margin for quantity not opened.
        const flipMargin = flipIsShort
            ? flipPremiumModel
                ? shortMarginBase * (flipQty / qty)
                : flipNotional * SHORT_MARGIN_FACTOR
            : 0;
        const flipCredit = flipPremiumModel ? flipNotional : 0;
        next[symbol] = {
            symbol,
            market: marketOf(symbol),
            qty: newQty,
            avgPrice: price,
            basisBase: flipNotional,
            marginHeldBase: flipMargin,
            ...(flipCredit > 0 ? { creditBase: flipCredit } : {}),
            realizedPnl: existing.realizedPnl + realized,
        };
        cashDelta += flipIsShort ? flipCredit - flipMargin : -flipNotional;
        marginDelta += flipMargin;
    } else if (Math.abs(newQty) < 1e-8) {
        delete next[symbol];
    } else {
        const remainingCredit = (existing.creditBase ?? 0) - closedCredit;
        next[symbol] = {
            ...existing,
            qty: newQty,
            basisBase: existing.basisBase - closedBasis,
            marginHeldBase: existing.marginHeldBase - releasedMargin,
            ...(remainingCredit > 0 ? { creditBase: remainingCredit } : {}),
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
    ts: number,
    /** Spot marks by underlying symbol. Needed to size a written option's margin. */
    marks: Record<string, number> = {}
): PaperState {
    if (!(fillQty > 1e-8) || !Number.isFinite(fillPrice) || fillPrice <= 0) return state;

    const notionalBase = toBase(order.symbol, fillQty * fillPrice, fx);
    // Options brokerage is a flat fee per ORDER. Charging it on every partial fill would
    // be a 200% overcharge on a three-way fill, so only the first fill pays it.
    const fee = feeFor(order.symbol, notionalBase, maker, order.side, Math.abs(fillQty), order.filledQty <= 1e-8);
    const applied = applyToPosition(
        state.positions,
        order.symbol,
        order.side,
        fillQty,
        fillPrice,
        fx,
        shortMarginFor(order.symbol, order.side, fillQty, fillPrice, fx, marks)
    );

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

    let next: PaperState = {
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

    // GROUP EFFECTS live here rather than in processTick, because fillOrder is the
    // single funnel both fill paths share — placeOrder's immediate market fill and
    // processTick's resting fill. Putting them anywhere else means one path behaves
    // differently from the other, which is the bug class this chokepoint exists to stop.

    // OCO: a fill on any member retires the rest. cancelOrder is pure and releases their
    // reservation, so no separate accounting is needed.
    if (order.groupKind === 'oco' && order.groupId) {
        for (const sibling of next.orders) {
            if (
                sibling.groupId === order.groupId &&
                sibling.id !== order.id &&
                (sibling.status === 'open' || sibling.status === 'partial')
            ) {
                next = cancelOrder(next, sibling.id, ts);
            }
        }
    }

    // Bracket: arm the children and RE-SIZE them to what the parent has actually filled.
    // Sizing to the parent's requested qty would let an exit be larger than the position
    // it is protecting, which on a partial fill would open a new position in reverse.
    if (order.groupKind === 'bracket') {
        next = {
            ...next,
            orders: next.orders.map((child) =>
                child.parentId === order.id && (child.status === 'open' || child.status === 'partial')
                    ? { ...child, armed: true, qty: updatedOrder.filledQty, updatedAt: ts }
                    : child
            ),
        };
    }

    return next;
}

// ---- placing ----

export interface PlaceOrderInput {
    symbol: string;
    side: PaperSide;
    type: PaperOrderType;
    qty: number;
    limitPrice?: number;
    stopPrice?: number;
    /** May only reduce a position, and reserves nothing. Used for bracket exits. */
    reduceOnly?: boolean;
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
    // Quantity is denominated in UNITS, as Indian brokers display it ("65", not "1 lot"),
    // which is what keeps `notional = qty * price` true and spares the pricing path a
    // multiplier. Lot size only constrains WHICH quantities are legal.
    const contract = getAsset(input.symbol)?.contract;
    if (contract && !isWholeLots(input.qty, contract.lotSize)) {
        return `${input.symbol} trades in lots of ${contract.lotSize}`;
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
    const fee = feeFor(input.symbol, notionalBase, input.type !== 'market', input.side, Math.abs(input.qty));
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
    ts = 0,
    /**
     * Spot marks by symbol, for sizing a written option's margin.
     *
     * Additive with a default, so every existing caller and test is unchanged. Without
     * a mark for the underlying, a written option falls back to the conservative
     * cash-covered model rather than to an invented spot price.
     */
    marks: Record<string, number> = {}
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
        ...(input.reduceOnly ? { reduceOnly: true } : {}),
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
        const filled = fillOrder(withOrder, base, input.qty, quote.price * slip, false, fx, ts, marks);
        return { state: filled, result: { status: 'filled', orderId: id } };
    }

    // Resting order: reserve the funding so it can't be double-spent by later orders.
    const notionalBase = toBase(input.symbol, input.qty * refPrice, fx);
    // A reduce-only order needs no funding: `validate` already lets a pure reduction
    // through regardless of cash, so reserving against an exit was always a hold with no
    // purpose — and on a bracket pair it is a double hold that rejects the structure.
    const reservedBase = input.reduceOnly
        ? 0
        : input.side === 'buy'
          ? notionalBase
          : notionalBase * SHORT_MARGIN_FACTOR;
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

export interface MultiLegResult extends PlaceResult {
    orderIds: string[];
    groupId: string;
}

/**
 * Place several orders as ONE structure — a spread, an OCO pair, or a bracket.
 *
 * ALL-OR-NOTHING. If any leg fails validation, every leg is recorded as `rejected`
 * sharing the group id and the same reason, and nothing else moves: no cash, no
 * positions, no reservation. A partially placed spread is not a smaller spread, it is a
 * naked position nobody asked for.
 *
 * RESERVATION is taken ONCE for the group, on leg 0. Reserving per leg is what makes a
 * bull call spread reject itself: `validate` sees the short leg in isolation and judges
 * it naked, so the pair reserves a long premium plus a naked-short margin against an
 * account that only ever needed the net debit.
 *
 * Legs are placed in order, so ids stay `ord-<seq>` in sequence and the group id is
 * derived from the first — no clock, no randomness, determinism preserved.
 */
export function placeMultiLeg(
    state: PaperState,
    legs: PlaceOrderInput[],
    kind: OrderGroupKind,
    quotes: Record<string, LiveQuote> = {},
    fx: FxRates = DEFAULT_FX,
    ts = 0,
    marks: Record<string, number> = {}
): { state: PaperState; result: MultiLegResult } {
    const groupId = `grp-${state.seq + 1}`;

    if (!legs.length) {
        return { state, result: { status: 'rejected', orderId: '', orderIds: [], groupId, reason: 'A group needs at least one leg.' } };
    }

    // Validate every leg against the SAME starting state, so one leg cannot consume the
    // funding another was judged against.
    for (const leg of legs) {
        const quote = quotes[leg.symbol];
        const asset = getAsset(leg.symbol);
        const refPrice =
            leg.type === 'limit' ? (leg.limitPrice ?? quote?.price ?? asset?.price ?? 0) : (quote?.price ?? asset?.price ?? 0);
        const reason = validate(state, leg, refPrice, fx);
        if (reason) return rejectGroup(state, legs, kind, groupId, reason, ts);
    }

    let next = state;
    const orderIds: string[] = [];

    for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        // Only leg 0 funds the structure; the rest reserve nothing, so the group is not
        // charged several times over for one economic exposure.
        const placed = placeOrder(next, i === 0 ? leg : { ...leg, reduceOnly: true }, quotes[leg.symbol], fx, ts, marks);

        if (placed.result.status === 'rejected') {
            // Passed the dry run and failed on placement means an earlier leg changed
            // the book underneath it. Unwind rather than leave a partial structure.
            return rejectGroup(state, legs, kind, groupId, placed.result.reason ?? 'A leg was refused.', ts);
        }

        orderIds.push(placed.result.orderId);
        next = {
            ...placed.state,
            orders: placed.state.orders.map((o) =>
                o.id === placed.result.orderId
                    ? {
                          ...o,
                          groupId,
                          legIndex: i,
                          groupKind: kind,
                          ...(kind === 'bracket' && i > 0 ? { parentId: orderIds[0], armed: false } : {}),
                      }
                    : o
            ),
        };
    }

    return { state: next, result: { status: 'accepted', orderId: orderIds[0], orderIds, groupId } };
}

/** Record every leg as rejected, sharing one reason. Touches nothing else. */
function rejectGroup(
    state: PaperState,
    legs: PlaceOrderInput[],
    kind: OrderGroupKind,
    groupId: string,
    reason: string,
    ts: number
): { state: PaperState; result: MultiLegResult } {
    let next = state;
    const orderIds: string[] = [];

    for (let i = 0; i < legs.length; i++) {
        const seq = next.seq + 1;
        const id = `ord-${seq}`;
        orderIds.push(id);
        const rejected: PaperOrder = {
            id,
            symbol: legs[i].symbol,
            market: marketOf(legs[i].symbol),
            side: legs[i].side,
            type: legs[i].type,
            qty: legs[i].qty,
            limitPrice: legs[i].limitPrice,
            stopPrice: legs[i].stopPrice,
            filledQty: 0,
            avgFillPrice: 0,
            status: 'rejected',
            rejectReason: reason,
            fees: 0,
            createdAt: ts,
            updatedAt: ts,
            reservedBase: 0,
            groupId,
            legIndex: i,
            groupKind: kind,
        };
        next = { ...next, seq, orders: [rejected, ...next.orders] };
    }

    return { state: next, result: { status: 'rejected', orderId: orderIds[0], orderIds, groupId, reason } };
}


/* --------------------------------------------------------------- expiry settlement */

export interface SettlementOutcome {
    symbol: string;
    /** Underlying level used. Labelled honestly — see the note below. */
    spot: number;
    intrinsic: number;
    qty: number;
}

/**
 * Settle expired option positions.
 *
 * For a EUROPEAN CASH-SETTLED option, settling is arithmetically identical to closing at
 * a price of `intrinsic`. So this reuses `applyToPosition` verbatim rather than adding a
 * second accounting path — which is what makes the reconciliation identity hold through
 * settlement for free, for long, short, in-the-money and worthless alike.
 *
 * TWO HONESTY CONSTRAINTS, both deliberate:
 *
 * 1. NSE settles index options on the weighted average of the underlying over the last
 *    half hour of the expiry day. We do not have that series. This settles at the last
 *    available mark and the UI must say so — it is not the official settlement price and
 *    must never be labelled as one.
 *
 * 2. With NO underlying mark available, the position is LEFT OPEN rather than settled at
 *    an invented price. A written option keeps its margin held, which is also what a real
 *    broker does. Fabricating a settlement price is the most tempting unsafe shortcut in
 *    this whole feature and it is refused here.
 */
export function settleExpiries(
    state: PaperState,
    quotes: Record<string, LiveQuote>,
    fx: FxRates = DEFAULT_FX,
    nowMs = 0
): { state: PaperState; settled: SettlementOutcome[]; awaitingMark: string[] } {
    const settled: SettlementOutcome[] = [];
    const awaitingMark: string[] = [];
    let next = state;

    // Sorted so settlement order is a pure function of the book, not of key insertion.
    const symbols = Object.keys(state.positions).sort();

    for (const symbol of symbols) {
        const position = next.positions[symbol];
        if (!position || Math.abs(position.qty) < 1e-8) continue;

        const contract = getAsset(symbol)?.contract;
        if (!contract || nowMs < contract.expiryMs) continue;

        const spot = quotes[contract.underlying]?.price;
        if (!Number.isFinite(spot) || (spot as number) <= 0) {
            awaitingMark.push(symbol);
            continue;
        }

        const intrinsicValue =
            contract.optionType === 'CE'
                ? Math.max(0, (spot as number) - contract.strike)
                : Math.max(0, contract.strike - (spot as number));

        const qty = Math.abs(position.qty);
        const side: PaperSide = position.qty > 0 ? 'sell' : 'buy';

        // Settlement is exchange-driven: no order was placed, so no brokerage. STT falls
        // on intrinsic value at its own rate, which `productFor(symbol, true)` selects.
        const notionalBase = toBase(symbol, qty * intrinsicValue, fx);
        const fee = chargeTotal({
            market: marketOf(symbol),
            side,
            product: productFor(symbol, true),
            notionalBase,
            maker: false,
            qty,
        });

        const applied = applyToPosition(next.positions, symbol, side, qty, intrinsicValue, fx);

        const seq = next.seq + 1;
        const order: PaperOrder = {
            id: `ord-${seq}`,
            symbol,
            market: marketOf(symbol),
            side,
            type: 'market',
            qty,
            filledQty: qty,
            avgFillPrice: intrinsicValue,
            status: 'filled',
            fees: fee,
            createdAt: nowMs,
            updatedAt: nowMs,
            reservedBase: 0,
            origin: 'settlement',
        };

        const fill: PaperFill = {
            id: `fill-${seq}`,
            orderId: order.id,
            symbol,
            market: marketOf(symbol),
            side,
            kind: 'settle',
            qty,
            price: intrinsicValue,
            fee,
            pnl: applied.realized,
            ts: nowMs,
        };

        const fills = [fill, ...next.fills];
        const isRoundTrip = applied.closedQty > 1e-8;

        next = {
            ...next,
            seq,
            account: {
                ...next.account,
                cash: next.account.cash + applied.cashDelta - fee,
                realizedGross: next.account.realizedGross + applied.realized,
                feesPaid: next.account.feesPaid + fee,
                fillCount: next.account.fillCount + 1,
                roundTrips: next.account.roundTrips + (isRoundTrip ? 1 : 0),
                roundTripWins: next.account.roundTripWins + (isRoundTrip && applied.realized > 0 ? 1 : 0),
            },
            positions: applied.positions,
            realizedBySymbol: isRoundTrip
                ? { ...next.realizedBySymbol, [symbol]: (next.realizedBySymbol[symbol] ?? 0) + applied.realized }
                : next.realizedBySymbol,
            orders: [order, ...next.orders],
            fills: fills.slice(0, MAX_FILLS_RETAINED),
            fillsTruncated: next.fillsTruncated || fills.length > MAX_FILLS_RETAINED,
        };

        // Any resting order on a settled contract is now meaningless.
        for (const o of next.orders) {
            if (o.symbol === symbol && (o.status === 'open' || o.status === 'partial')) {
                next = cancelOrder(next, o.id, nowMs);
            }
        }

        settled.push({ symbol, spot: spot as number, intrinsic: intrinsicValue, qty });
    }

    return { state: next, settled, awaitingMark };
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
/**
 * Cancel every resting member of a group.
 *
 * Cancelling a bracket PARENT must cascade: its children would otherwise rest forever
 * with no position behind them, and would fire against whatever position happened to
 * exist later.
 */
export function cancelGroup(state: PaperState, groupId: string, ts = 0): PaperState {
    let next = state;
    for (const o of state.orders) {
        if (o.groupId === groupId && (o.status === 'open' || o.status === 'partial')) {
            next = cancelOrder(next, o.id, ts);
        }
    }
    return next;
}

/** Cancel an order, and any bracket children that were waiting on it. */
export function cancelWithChildren(state: PaperState, orderId: string, ts = 0): PaperState {
    let next = cancelOrder(state, orderId, ts);
    for (const child of state.orders) {
        if (child.parentId === orderId && (child.status === 'open' || child.status === 'partial')) {
            next = cancelOrder(next, child.id, ts);
        }
    }
    return next;
}

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
        // A bracket child whose parent has not filled yet. `armed === false` is the
        // waiting state; absent means "not a child" and rests normally, so `!armed`
        // here would freeze every ordinary order in the book.
        if (current.armed === false) continue;

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
            const lot = getAsset(o.symbol)?.contract?.lotSize;
            if (lot) {
                // A contract trades in lots, so a partial fill must land on a lot
                // boundary too. Without this a 65-lot option fills 54 units — a quantity
                // no exchange would produce, and one `validate` would reject if you tried
                // to place it. Fill at least one lot, or the whole remainder if less than
                // a lot is left (which a prior partial can leave behind).
                const lots = Math.max(1, Math.floor((remaining * frac) / lot));
                fillQty = Math.min(remaining, lots * lot);
            } else {
                // Whole-unit instruments: at least one unit, never more than what is left.
                fillQty = Math.min(remaining, Math.max(1, Math.floor(remaining * frac)));
            }
        }
        if (!(fillQty > 1e-8)) continue;

        const fresh = next.orders.find((x) => x.id === o.id);
        if (!fresh) continue;
        next = fillOrder(next, fresh, fillQty, fillPrice, maker, fx, ts, marksFrom(quotes));
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
        // A written option's premium is ALREADY in `cash`, and unrealizedPnlBase adds
        // `basisBase − marketValue` which contains it again. Netting the credit out is
        // what stops the account appearing richer by the premium the moment it is
        // written. creditBase is 0 for short stock, so that case is untouched.
        total +=
            p.qty >= 0
                ? positionMarketValueBase(p, quotes, fx)
                : unrealizedPnlBase(p, quotes, fx) - (p.creditBase ?? 0);
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
        if (p.qty > 0) {
            lhs += p.basisBase;
        } else if (p.qty < 0) {
            // A short that CREDITED cash at open — a written option — already has that
            // premium sitting in `cash`, so subtract it or the identity counts it twice.
            // Short stock credits nothing, so this term vanishes and the equity cases
            // are arithmetically identical to before options existed.
            lhs -= p.creditBase ?? 0;
        }
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
    const v = typeof s.version === 'number' ? s.version : 0;
    const structurallyOk = Boolean(s.account && s.positions && Array.isArray(s.orders));

    // Forward-migratable band. Everything added since v2 is OPTIONAL and every reader
    // uses `?? <legacy default>`, so a v2 blob already IS a valid current blob and there
    // is nothing to rewrite. This branch exists so that a future bump is a code change
    // here rather than a silent wipe of somebody's entire book.
    if (structurallyOk && v >= MIN_COMPATIBLE_PAPER_VERSION && v <= PAPER_STATE_VERSION) {
        return { state: { ...(s as PaperState), version: PAPER_STATE_VERSION }, reset: false };
    }

    // A blob from a NEWER build. This device is behind, not corrupt — discarding a book
    // we merely cannot read yet would destroy data the other device is still using.
    if (structurallyOk && v > PAPER_STATE_VERSION) {
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
        typeof s.version === 'number' &&
        s.version >= MIN_COMPATIBLE_PAPER_VERSION &&
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
