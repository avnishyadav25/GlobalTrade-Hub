import { describe, it, expect, beforeAll } from 'vitest';
import {
    newPaperState,
    placeOrder,
    placeMultiLeg,
    processTick,
    settleExpiries,
    cancelWithChildren,
    cancelGroup,
    assertReconciled,
    reconciliationError,
    type PaperState,
    type FxRates,
} from '@/lib/paperEngine';
import { registerInstruments } from '@/lib/instruments';
import { buildOptionSymbol, makeContract, formatContract } from './contract';
import type { LiveQuote } from '@/stores/marketStore';

// Multi-leg groups and expiry settlement.
//
// The properties that matter here are all about NOT leaving the book in a half-applied
// state: a spread that partly places is a naked position nobody asked for, an OCO pair
// that both fill is double the intended size, and a bracket child that fires before its
// parent is an exit from a position that does not exist.

const FX: FxRates = { INR: 1, USD: 95.3, JPY: 95.3 / 156.82, stale: false };
const UNDERLYING = 'NIFTY 50';
const EXPIRY_MS = Date.UTC(2026, 7, 18, 10, 0, 0); // 15:30 IST on 2026-08-18

const LONG = makeContract({ root: 'NIFTY', expiry: '2026-08-18', strike: 24500, optionType: 'CE', lotSize: 65 })!;
const SHORT = makeContract({ root: 'NIFTY', expiry: '2026-08-18', strike: 24800, optionType: 'CE', lotSize: 65 })!;
const LONG_SYM = buildOptionSymbol(LONG);
const SHORT_SYM = buildOptionSymbol(SHORT);

const asset = (symbol: string, price: number, contract?: typeof LONG) => ({
    symbol, name: contract ? formatContract(contract) : symbol,
    market: 'india' as const, exchange: 'NFO', quoteCcy: 'INR' as const, fractional: false,
    price, change: 0, changePercent: 0, volume: 0, high24h: 0, low24h: 0,
    ...(contract ? { contract } : {}),
});

const q = (symbol: string, price: number): LiveQuote =>
    ({ symbol, price, change: 0, changePercent: 0, ts: 0 } as LiveQuote);

beforeAll(() => {
    registerInstruments([
        asset(LONG_SYM, 300, LONG),
        asset(SHORT_SYM, 120, SHORT),
        { ...asset(UNDERLYING, 24471), exchange: 'NSE' },
        asset('EQ TEST', 1000),
    ]);
});

const fresh = () => newPaperState(2_000_000, 0);
const marks = { [UNDERLYING]: 24471 };
const quotes = { [LONG_SYM]: q(LONG_SYM, 300), [SHORT_SYM]: q(SHORT_SYM, 120), [UNDERLYING]: q(UNDERLYING, 24471) };

/** A bull call spread: buy the lower strike, sell the higher one. */
const spreadLegs = (qty = 65) => [
    { symbol: LONG_SYM, side: 'buy' as const, type: 'market' as const, qty },
    { symbol: SHORT_SYM, side: 'sell' as const, type: 'market' as const, qty },
];

describe('multi-leg placement', () => {
    it('places every leg of a spread and groups them', () => {
        const { state, result } = placeMultiLeg(fresh(), spreadLegs(), 'multileg', quotes, FX, 0, marks);
        expect(result.status).toBe('accepted');
        expect(result.orderIds).toHaveLength(2);

        const legs = state.orders.filter((o) => o.groupId === result.groupId);
        expect(legs).toHaveLength(2);
        expect(legs.every((o) => o.groupKind === 'multileg')).toBe(true);
        expect(new Set(legs.map((o) => o.legIndex))).toEqual(new Set([0, 1]));

        expect(state.positions[LONG_SYM].qty).toBe(65);
        expect(state.positions[SHORT_SYM].qty).toBe(-65);
        expect(() => assertReconciled(state)).not.toThrow();
    });

    it('is ALL-OR-NOTHING when a leg is invalid', () => {
        // A partially placed spread is not a smaller spread — it is a naked position.
        const before = fresh();
        const { state, result } = placeMultiLeg(
            before,
            [spreadLegs()[0], { symbol: SHORT_SYM, side: 'sell', type: 'market', qty: 100 }], // 100 is not a lot multiple
            'multileg',
            quotes,
            FX,
            0,
            marks
        );

        expect(result.status).toBe('rejected');
        expect(result.reason).toMatch(/lots of 65/);

        // Nothing moved except the audit trail.
        expect(state.positions).toEqual({});
        expect(state.account.cash).toBe(before.account.cash);
        expect(state.account.reservedCash).toBe(before.account.reservedCash);

        // Every leg is recorded, so the Orders screen shows the structure that was
        // refused rather than nothing at all.
        const rejected = state.orders.filter((o) => o.groupId === result.groupId);
        expect(rejected).toHaveLength(2);
        expect(rejected.every((o) => o.status === 'rejected')).toBe(true);
        expect(rejected.every((o) => o.rejectReason === result.reason)).toBe(true);
        expect(() => assertReconciled(state)).not.toThrow();
    });

    it('reserves the group once rather than once per leg', () => {
        // Reserving per leg is what makes a spread reject itself: validate judges the
        // short leg naked in isolation, so the pair holds a long premium PLUS a
        // naked-short margin against an account that only needed the net debit.
        const legs = [
            { symbol: LONG_SYM, side: 'buy' as const, type: 'limit' as const, qty: 65, limitPrice: 300 },
            { symbol: SHORT_SYM, side: 'sell' as const, type: 'limit' as const, qty: 65, limitPrice: 120 },
        ];
        const { state } = placeMultiLeg(fresh(), legs, 'multileg', quotes, FX, 0, marks);
        const grouped = state.orders.filter((o) => o.groupId);
        const funding = grouped.filter((o) => o.reservedBase > 0);
        expect(funding).toHaveLength(1);
        expect(funding[0].legIndex).toBe(0);
    });

    it('refuses an empty group', () => {
        expect(placeMultiLeg(fresh(), [], 'multileg', quotes, FX).result.status).toBe('rejected');
    });
});

describe('OCO', () => {
    const ocoLegs = () => [
        { symbol: LONG_SYM, side: 'buy' as const, type: 'limit' as const, qty: 65, limitPrice: 250 },
        { symbol: LONG_SYM, side: 'buy' as const, type: 'stop' as const, qty: 65, stopPrice: 360 },
    ];

    it('cancels the sibling when one leg fills', () => {
        const { state, result } = placeMultiLeg(fresh(), ocoLegs(), 'oco', quotes, FX, 0, marks);
        expect(result.status).toBe('accepted');

        // Price falls to the limit — that leg fills, the stop leg must retire.
        const after = processTick(state, { [LONG_SYM]: q(LONG_SYM, 240), [UNDERLYING]: q(UNDERLYING, 24471) }, FX, 1);

        const legs = after.orders.filter((o) => o.groupId === result.groupId);
        expect(legs.filter((o) => o.status === 'filled')).toHaveLength(1);
        expect(legs.filter((o) => o.status === 'cancelled')).toHaveLength(1);
        // Exactly one fill means exactly one position, not double the intended size.
        expect(after.positions[LONG_SYM].qty).toBe(65);
    });

    it('releases the group reservation when the sibling is cancelled', () => {
        const { state, result } = placeMultiLeg(fresh(), ocoLegs(), 'oco', quotes, FX, 0, marks);
        const after = processTick(state, { [LONG_SYM]: q(LONG_SYM, 240), [UNDERLYING]: q(UNDERLYING, 24471) }, FX, 1);
        expect(after.account.reservedCash).toBeCloseTo(0, 6);
        expect(() => assertReconciled(after)).not.toThrow();
        void result;
    });
});

describe('bracket', () => {
    const bracketLegs = () => [
        { symbol: LONG_SYM, side: 'buy' as const, type: 'limit' as const, qty: 130, limitPrice: 300 },
        { symbol: LONG_SYM, side: 'sell' as const, type: 'limit' as const, qty: 130, limitPrice: 400 },
        { symbol: LONG_SYM, side: 'sell' as const, type: 'stop' as const, qty: 130, stopPrice: 200 },
    ];

    it('leaves the children inert until the parent fills', () => {
        const { state } = placeMultiLeg(fresh(), bracketLegs(), 'bracket', quotes, FX, 0, marks);
        const children = state.orders.filter((o) => o.parentId);
        expect(children).toHaveLength(2);
        expect(children.every((c) => c.armed === false)).toBe(true);
        // Children reserve nothing — they are exits, and validate already lets a pure
        // reduction through regardless of cash.
        expect(children.every((c) => c.reservedBase === 0)).toBe(true);
    });

    it('does not fire an unarmed child even when its price is touched', () => {
        // The take-profit at 400 would be crossed immediately. Firing it before the
        // parent filled would open a SHORT position out of nowhere.
        const { state } = placeMultiLeg(fresh(), bracketLegs(), 'bracket', quotes, FX, 0, marks);
        const after = processTick(state, { [LONG_SYM]: q(LONG_SYM, 450), [UNDERLYING]: q(UNDERLYING, 24471) }, FX, 1);
        expect(after.positions[LONG_SYM]).toBeUndefined();
        expect(after.orders.filter((o) => o.status === 'filled')).toHaveLength(0);
    });

    it('arms and re-sizes the children to what the parent actually filled', () => {
        const { state, result } = placeMultiLeg(fresh(), bracketLegs(), 'bracket', quotes, FX, 0, marks);
        const parentId = result.orderIds[0];

        // Parent fills at its limit.
        const after = processTick(state, { [LONG_SYM]: q(LONG_SYM, 280), [UNDERLYING]: q(UNDERLYING, 24471) }, FX, 1);
        const parent = after.orders.find((o) => o.id === parentId)!;
        const children = after.orders.filter((o) => o.parentId === parentId);

        expect(children.every((c) => c.armed === true)).toBe(true);
        // Sized to the parent's FILLED quantity, not its requested one. An exit larger
        // than the position it protects would open a reverse position on a partial fill.
        expect(children.every((c) => c.qty === parent.filledQty)).toBe(true);
    });

    it('cancels waiting children when the parent is cancelled', () => {
        const { state, result } = placeMultiLeg(fresh(), bracketLegs(), 'bracket', quotes, FX, 0, marks);
        const after = cancelWithChildren(state, result.orderIds[0], 1);
        const live = after.orders.filter((o) => o.status === 'open' || o.status === 'partial');
        expect(live).toHaveLength(0);
        expect(after.account.reservedCash).toBeCloseTo(0, 6);
    });

    it('cancels the whole group by id', () => {
        const { state, result } = placeMultiLeg(fresh(), bracketLegs(), 'bracket', quotes, FX, 0, marks);
        const after = cancelGroup(state, result.groupId, 1);
        expect(after.orders.filter((o) => o.status === 'open')).toHaveLength(0);
        expect(() => assertReconciled(after)).not.toThrow();
    });
});

describe('expiry settlement', () => {
    const atExpiry = EXPIRY_MS + 1000;

    it('settles a long ITM call at intrinsic value', () => {
        const { state } = placeOrder(fresh(), { symbol: LONG_SYM, side: 'buy', type: 'market', qty: 65 }, q(LONG_SYM, 300), FX, 0, marks);
        const spot = 25000; // 500 above the 24500 strike
        const out = settleExpiries(state, { [UNDERLYING]: q(UNDERLYING, spot) }, FX, atExpiry);

        expect(out.settled).toHaveLength(1);
        expect(out.settled[0].intrinsic).toBe(500);
        expect(out.state.positions[LONG_SYM]).toBeUndefined();
        expect(() => assertReconciled(out.state)).not.toThrow();
    });

    it('settles a worthless option at zero and keeps the identity', () => {
        const { state } = placeOrder(fresh(), { symbol: LONG_SYM, side: 'buy', type: 'market', qty: 65 }, q(LONG_SYM, 300), FX, 0, marks);
        const out = settleExpiries(state, { [UNDERLYING]: q(UNDERLYING, 24000) }, FX, atExpiry);
        expect(out.settled[0].intrinsic).toBe(0);
        expect(out.state.positions[LONG_SYM]).toBeUndefined();
        // The whole premium is lost — that is what an expired OTM option does.
        expect(out.state.account.realizedGross).toBeLessThan(0);
        expect(() => assertReconciled(out.state)).not.toThrow();
    });

    it('settles a WRITTEN option and releases its margin', () => {
        const { state } = placeOrder(fresh(), { symbol: SHORT_SYM, side: 'sell', type: 'market', qty: 65 }, q(SHORT_SYM, 120), FX, 0, marks);
        expect(state.positions[SHORT_SYM].marginHeldBase).toBeGreaterThan(0);

        const out = settleExpiries(state, { [UNDERLYING]: q(UNDERLYING, 24000) }, FX, atExpiry);
        expect(out.state.positions[SHORT_SYM]).toBeUndefined();
        // Writing an option that expires worthless keeps the premium.
        expect(out.state.account.realizedGross).toBeGreaterThan(0);
        expect(() => assertReconciled(out.state)).not.toThrow();
    });

    it('REFUSES to settle without an underlying mark, rather than inventing one', () => {
        // The single most tempting unsafe shortcut in this feature. A written option
        // keeps its margin held, which is what a real broker does too.
        const { state } = placeOrder(fresh(), { symbol: LONG_SYM, side: 'buy', type: 'market', qty: 65 }, q(LONG_SYM, 300), FX, 0, marks);
        const out = settleExpiries(state, {}, FX, atExpiry);

        expect(out.settled).toHaveLength(0);
        expect(out.awaitingMark).toEqual([LONG_SYM]);
        expect(out.state.positions[LONG_SYM]).toBeDefined();
        expect(out.state).toBe(state); // untouched, not merely equivalent
    });

    it('does nothing before expiry', () => {
        const { state } = placeOrder(fresh(), { symbol: LONG_SYM, side: 'buy', type: 'market', qty: 65 }, q(LONG_SYM, 300), FX, 0, marks);
        const out = settleExpiries(state, { [UNDERLYING]: q(UNDERLYING, 25000) }, FX, EXPIRY_MS - 1000);
        expect(out.settled).toHaveLength(0);
        expect(out.state.positions[LONG_SYM]).toBeDefined();
    });

    it('cancels resting orders on a contract it settles', () => {
        let s = placeOrder(fresh(), { symbol: LONG_SYM, side: 'buy', type: 'market', qty: 65 }, q(LONG_SYM, 300), FX, 0, marks).state;
        s = placeOrder(s, { symbol: LONG_SYM, side: 'sell', type: 'limit', qty: 65, limitPrice: 900 }, q(LONG_SYM, 300), FX, 0, marks).state;
        expect(s.orders.some((o) => o.status === 'open')).toBe(true);

        const out = settleExpiries(s, { [UNDERLYING]: q(UNDERLYING, 25000) }, FX, atExpiry);
        expect(out.state.orders.filter((o) => o.status === 'open')).toHaveLength(0);
        expect(out.state.account.reservedCash).toBeCloseTo(0, 6);
        expect(() => assertReconciled(out.state)).not.toThrow();
    });

    it('leaves equity untouched by settlement itself, beyond fees', () => {
        // Settling is closing at intrinsic. Marked at that same intrinsic beforehand,
        // the account value must not jump — a jump would mean settlement invented value.
        const { state } = placeOrder(fresh(), { symbol: LONG_SYM, side: 'buy', type: 'market', qty: 65 }, q(LONG_SYM, 300), FX, 0, marks);
        const before = state.account.cash + 65 * 500; // marked at intrinsic
        const out = settleExpiries(state, { [UNDERLYING]: q(UNDERLYING, 25000) }, FX, atExpiry);
        expect(out.state.account.cash).toBeCloseTo(before - (out.state.account.feesPaid - state.account.feesPaid), 6);
    });

    it('is deterministic — settlement order does not depend on key insertion', () => {
        let a = placeOrder(fresh(), { symbol: LONG_SYM, side: 'buy', type: 'market', qty: 65 }, q(LONG_SYM, 300), FX, 0, marks).state;
        a = placeOrder(a, { symbol: SHORT_SYM, side: 'sell', type: 'market', qty: 65 }, q(SHORT_SYM, 120), FX, 0, marks).state;

        let b = placeOrder(fresh(), { symbol: SHORT_SYM, side: 'sell', type: 'market', qty: 65 }, q(SHORT_SYM, 120), FX, 0, marks).state;
        b = placeOrder(b, { symbol: LONG_SYM, side: 'buy', type: 'market', qty: 65 }, q(LONG_SYM, 300), FX, 0, marks).state;

        const marksAt = { [UNDERLYING]: q(UNDERLYING, 25000) };
        const sa = settleExpiries(a, marksAt, FX, atExpiry);
        const sb = settleExpiries(b, marksAt, FX, atExpiry);

        expect(sa.settled.map((x) => x.symbol)).toEqual(sb.settled.map((x) => x.symbol));
        expect(Math.abs(reconciliationError(sa.state))).toBeLessThan(1e-6);
        expect(Math.abs(reconciliationError(sb.state))).toBeLessThan(1e-6);
    });
});

describe('partial fills on a lot-traded contract', () => {
    it('never fills a fraction of a lot', () => {
        // Caught by a failing OCO test: the partial-fill simulator filled 54 units of a
        // 65-lot contract — a quantity no exchange produces, and one `validate` would
        // itself reject. Partial fills must land on lot boundaries.
        let s = placeMultiLeg(
            fresh(),
            [{ symbol: LONG_SYM, side: 'buy', type: 'limit', qty: 65 * 4, limitPrice: 300 }],
            'multileg',
            quotes,
            FX,
            0,
            marks
        ).state;

        for (let i = 1; i <= 8; i++) {
            s = processTick(s, { [LONG_SYM]: q(LONG_SYM, 250), [UNDERLYING]: q(UNDERLYING, 24471) }, FX, i);
            const order = s.orders[s.orders.length - 1];
            expect(order.filledQty % 65, `tick ${i} filled ${order.filledQty}`).toBe(0);
        }
        expect(() => assertReconciled(s)).not.toThrow();
    });
});

describe('determinism with groups', () => {
    it('produces byte-identical state across two identical runs', () => {
        // The engine's existing determinism test covers single orders. Groups add id
        // allocation and cascading cancels, which is exactly where an accidental
        // Date.now() or Math.random() would creep in.
        const run = (): PaperState => {
            let s = fresh();
            s = placeMultiLeg(s, spreadLegs(), 'multileg', quotes, FX, 0, marks).state;
            s = placeMultiLeg(
                s,
                [
                    { symbol: LONG_SYM, side: 'sell', type: 'limit', qty: 65, limitPrice: 500 },
                    { symbol: LONG_SYM, side: 'sell', type: 'stop', qty: 65, stopPrice: 150 },
                ],
                'oco',
                quotes,
                FX,
                0,
                marks
            ).state;
            for (let i = 0; i < 6; i++) s = processTick(s, quotes, FX, i + 1);
            return s;
        };
        expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    });
});
