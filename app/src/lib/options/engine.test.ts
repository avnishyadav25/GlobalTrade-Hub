import { describe, it, expect, beforeAll } from 'vitest';
import {
    newPaperState,
    placeOrder,
    assertReconciled,
    reconciliationError,
    equity,
    migratePaperState,
    isPaperState,
    PAPER_STATE_VERSION,
    type PaperState,
    type FxRates,
} from '@/lib/paperEngine';
import { registerInstruments } from '@/lib/instruments';
import { buildOptionSymbol, parseOptionSymbol, makeContract, isWholeLots, floorToLot, formatContract, isValidOptionContract, OPTION_ROOTS } from './contract';
import { shortOptionMargin, APPROX_LABEL } from './margin';
import { chargesFor } from '@/lib/charges';
import type { LiveQuote } from '@/stores/marketStore';

// Options in the paper engine.
//
// The single most important assertion in this file is that the LEDGER IDENTITY holds
// for a written option. A short option credits premium AND posts margin, which is a
// shape the engine did not have before — short stock debits its notional straight into
// margin and credits nothing. Everything else here supports that.

const FX: FxRates = { INR: 1, USD: 95.3, JPY: 95.3 / 156.82, stale: false };

const CONTRACT = makeContract({ root: 'NIFTY', expiry: '2026-08-18', strike: 24500, optionType: 'CE', lotSize: 65 })!;
const SYMBOL = buildOptionSymbol(CONTRACT);
const UNDERLYING = 'NIFTY 50';

const quote = (price: number): LiveQuote => ({ symbol: SYMBOL, price, change: 0, changePercent: 0, ts: 0 } as LiveQuote);

beforeAll(() => {
    registerInstruments([
        {
            symbol: SYMBOL,
            name: formatContract(CONTRACT),
            market: 'india',
            exchange: 'NFO',
            quoteCcy: 'INR',
            fractional: false,
            price: 120,
            change: 0,
            changePercent: 0,
            volume: 0,
            high24h: 0,
            low24h: 0,
            contract: CONTRACT,
        },
        {
            symbol: UNDERLYING,
            name: 'Nifty 50',
            market: 'india',
            exchange: 'NSE',
            quoteCcy: 'INR',
            fractional: false,
            price: 24471,
            change: 0,
            changePercent: 0,
            volume: 0,
            high24h: 0,
            low24h: 0,
        },
    ]);
});

const fresh = () => newPaperState(2_000_000, 0);
const marks = { [UNDERLYING]: 24471 };

/** Market orders fill through 3bps of taker slippage, so the fill price is authoritative. */
const lastFillPrice = (s: PaperState) => s.fills[0].price;

const buy = (s: PaperState, qty: number, price: number) =>
    placeOrder(s, { symbol: SYMBOL, side: 'buy', type: 'market', qty }, quote(price), FX, 0, marks);
const sell = (s: PaperState, qty: number, price: number) =>
    placeOrder(s, { symbol: SYMBOL, side: 'sell', type: 'market', qty }, quote(price), FX, 0, marks);

describe('contract identity', () => {
    it('round-trips every symbol it builds, inside the 24-character limit', () => {
        // SYMBOL_RE caps at 24 chars over a restricted charset, and positions are keyed
        // by symbol alone — so a collision or an over-long symbol would be silent.
        const SYMBOL_RE = /^[A-Za-z0-9^][A-Za-z0-9.^=/\- ]{0,23}$/;
        for (const root of OPTION_ROOTS) {
            for (const strike of [1500, 24500, 52000, 100000]) {
                for (const optionType of ['CE', 'PE'] as const) {
                    const c = { root, expiry: '2026-01-29', strike, optionType };
                    const sym = buildOptionSymbol(c);
                    expect(sym.length, sym).toBeLessThanOrEqual(24);
                    expect(SYMBOL_RE.test(sym), sym).toBe(true);
                    expect(parseOptionSymbol(sym)).toEqual(c);
                }
            }
        }
    });

    it('distinguishes NIFTY from BANKNIFTY despite the shared prefix', () => {
        // The root set is closed and matched longest-first. Getting this wrong would
        // parse a BANKNIFTY contract as NIFTY with a nonsense date.
        expect(parseOptionSymbol('BANKNIFTY26012952000PE')!.root).toBe('BANKNIFTY');
        expect(parseOptionSymbol('NIFTY26012924500CE')!.root).toBe('NIFTY');
    });

    it('refuses a contract with no lot size instead of defaulting one', () => {
        // Lot size decides the quantity step. Guessing it mis-sizes every order in the
        // contract by a whole multiple.
        expect(makeContract({ root: 'NIFTY', expiry: '2026-08-18', strike: 24500, optionType: 'CE', lotSize: 0 })).toBeNull();
        expect(makeContract({ root: 'NIFTY', expiry: 'nonsense', strike: 24500, optionType: 'CE', lotSize: 65 })).toBeNull();
    });

    it('accepts NSE expiry strings and computes the settlement instant in IST', () => {
        const c = makeContract({ root: 'NIFTY', expiry: '18-Aug-2026', strike: 24500, optionType: 'CE', lotSize: 65 })!;
        expect(c.expiry).toBe('2026-08-18');
        // 15:30 IST is 10:00 UTC. IST has no daylight saving, so this is exact.
        expect(new Date(c.expiryMs).toISOString()).toBe('2026-08-18T10:00:00.000Z');
    });

    it('rejects a malformed contract arriving from persisted state', () => {
        expect(isValidOptionContract(CONTRACT)).toBe(true);
        expect(isValidOptionContract({ ...CONTRACT, lotSize: 0 })).toBe(false);
        expect(isValidOptionContract({ ...CONTRACT, settlement: 'physical' })).toBe(false);
        expect(isValidOptionContract({ ...CONTRACT, root: 'RELIANCE' })).toBe(false);
        expect(isValidOptionContract(null)).toBe(false);
    });

    it('floors to whole lots and never rounds up into a larger trade', () => {
        expect(floorToLot(200, 65)).toBe(195);
        expect(floorToLot(64, 65)).toBe(0);
        expect(isWholeLots(130, 65)).toBe(true);
        expect(isWholeLots(100, 65)).toBe(false);
    });
});

describe('order validation', () => {
    it('refuses a quantity that is not a whole number of lots', () => {
        const r = buy(fresh(), 100, 120);
        expect(r.result.status).toBe('rejected');
        expect(r.result.reason).toMatch(/lots of 65/);
    });

    it('accepts a whole multiple of the lot size', () => {
        expect(buy(fresh(), 130, 120).result.status).toBe('filled');
    });
});

describe('the ledger identity under options', () => {
    it('holds when BUYING an option', () => {
        const { state } = buy(fresh(), 65, 120);
        expect(() => assertReconciled(state)).not.toThrow();
        // A long option is a straight debit: no margin, cost is the premium.
        const pos = state.positions[SYMBOL];
        expect(pos.qty).toBe(65);
        expect(pos.marginHeldBase).toBe(0);
        expect(pos.creditBase ?? 0).toBe(0);
    });

    it('holds when WRITING an option — the case the old model had no shape for', () => {
        const { state } = sell(fresh(), 65, 120);
        expect(() => assertReconciled(state)).not.toThrow();

        const pos = state.positions[SYMBOL];
        expect(pos.qty).toBe(-65);
        // Premium is CREDITED, and margin is posted separately and is unrelated to it.
        expect(pos.creditBase).toBeCloseTo(65 * lastFillPrice(state), 6);
        expect(pos.marginHeldBase).toBeGreaterThan(0);
        expect(pos.marginHeldBase).not.toBeCloseTo(65 * 120, 0);
    });

    it('holds through a partial close of a written option', () => {
        let s = sell(fresh(), 130, 120).state;
        expect(() => assertReconciled(s)).not.toThrow();
        s = buy(s, 65, 90).state;
        expect(() => assertReconciled(s)).not.toThrow();
        // Buying back cheaper than it was written is a profit for the writer.
        expect(s.account.realizedGross).toBeGreaterThan(0);
        s = buy(s, 65, 90).state;
        expect(() => assertReconciled(s)).not.toThrow();
        expect(s.positions[SYMBOL]).toBeUndefined();
    });

    it('holds when a written option is bought back at a loss', () => {
        let s = sell(fresh(), 65, 120).state;
        s = buy(s, 65, 400).state;
        expect(() => assertReconciled(s)).not.toThrow();
        expect(s.account.realizedGross).toBeLessThan(0);
    });

    it('holds across a randomised walk that mixes both sides', () => {
        // The engine's own 300-step walk covers equity. This is the option analogue, and
        // it is the test most likely to catch a booking asymmetry.
        let s = fresh();
        let seed = 7;
        const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

        for (let i = 0; i < 200; i++) {
            const lots = 1 + Math.floor(rnd() * 3);
            const price = 20 + rnd() * 300;
            const side = rnd() > 0.5 ? 'buy' : 'sell';
            const r = placeOrder(s, { symbol: SYMBOL, side, type: 'market', qty: lots * 65 }, quote(price), FX, 0, marks);
            s = r.state;
            expect(Math.abs(reconciliationError(s)), `step ${i}`).toBeLessThan(1e-6);
        }
    });
});

describe('equity', () => {
    it('does not count a written premium twice', () => {
        // The premium is already in `cash`, and unrealizedPnlBase adds basis − market
        // value which contains it again. Marked at its own fill price, a freshly written
        // option must leave equity at starting cash less fees — exactly the property the
        // engine already asserts for short stock.
        const { state } = sell(fresh(), 65, 120);
        const marked = { [SYMBOL]: quote(lastFillPrice(state)) };
        expect(equity(state, marked, FX)).toBeCloseTo(2_000_000 - state.account.feesPaid, 6);
    });

    it('rises as a written option loses value', () => {
        const { state } = sell(fresh(), 65, 120);
        const written = lastFillPrice(state);
        const atWritten = equity(state, { [SYMBOL]: quote(written) }, FX);
        const halved = equity(state, { [SYMBOL]: quote(written / 2) }, FX);
        expect(halved).toBeGreaterThan(atWritten);
        expect(halved - atWritten).toBeCloseTo(65 * (written / 2), 6);
    });
});

describe('charges', () => {
    const premium = 65 * 120; // one lot at ₹120

    it('charges a FLAT brokerage on options, not the capped equity percentage', () => {
        const sellSide = chargesFor({ market: 'india', side: 'sell', product: 'options', notionalBase: premium });
        expect(sellSide.brokerage).toBe(20);
        // Ten times the premium must not change the brokerage — that is what "flat" means.
        const big = chargesFor({ market: 'india', side: 'sell', product: 'options', notionalBase: premium * 10 });
        expect(big.brokerage).toBe(20);
    });

    it('charges brokerage once per ORDER, not once per partial fill', () => {
        // A three-way fill paying ₹20 each time is a 200% overcharge on one order.
        const later = chargesFor({ market: 'india', side: 'sell', product: 'options', notionalBase: premium, chargeBrokerage: false });
        expect(later.brokerage).toBe(0);
    });

    it('charges STT on the sell side only, on premium', () => {
        const s = chargesFor({ market: 'india', side: 'sell', product: 'options', notionalBase: premium });
        const b = chargesFor({ market: 'india', side: 'buy', product: 'options', notionalBase: premium });
        expect(s.stt).toBeCloseTo(premium * 0.001, 8);
        expect(b.stt).toBe(0);
    });

    it('charges settlement STT on INTRINSIC value at a different rate', () => {
        const settle = chargesFor({ market: 'india', side: 'sell', product: 'options-settlement', notionalBase: 50_000 });
        expect(settle.stt).toBeCloseTo(50_000 * 0.00125, 8);
        // Settlement is exchange-driven — there is no order, so no brokerage.
        expect(settle.brokerage).toBe(0);
    });

    it('leaves the equity schedule alone', () => {
        // Regression guard: adding options must not have changed what an equity trade
        // costs, or every existing number in the app shifts.
        const eq = chargesFor({ market: 'india', side: 'sell', product: 'intraday', notionalBase: 100_000 });
        expect(eq.stt).toBeCloseTo(25, 6);
        expect(eq.brokerage).toBeCloseTo(20, 6);
    });
});

describe('margin model', () => {
    it('never claims SPAN without a risk file', () => {
        const q = shortOptionMargin(CONTRACT, 24471, 120, 65);
        expect(q.model).toBe('approx-v1');
        expect(q.label).toBe(APPROX_LABEL);
        expect(q.label).not.toMatch(/SPAN\s+\d/);
    });

    it('labels itself SPAN only when a file actually covers the underlying', () => {
        const covering = {
            version: '2026-08-11',
            scanPct: { NIFTY: 0.04 },
            exposurePct: { NIFTY: 0.02 },
            shortOptionMinPct: { NIFTY: 0.0175 },
        };
        expect(shortOptionMargin(CONTRACT, 24471, 120, 65, covering).model).toBe('span-2026-08-11');

        // A file that does not mention this root must NOT silently upgrade the label.
        const nonCovering = { version: '2026-08-11', scanPct: { BANKNIFTY: 0.04 }, exposurePct: { BANKNIFTY: 0.03 }, shortOptionMinPct: { BANKNIFTY: 0.0175 } };
        expect(shortOptionMargin(CONTRACT, 24471, 120, 65, nonCovering).model).toBe('approx-v1');
    });

    it('requires less margin the further out of the money the option is', () => {
        const near = shortOptionMargin({ root: 'NIFTY', strike: 24500, optionType: 'CE' }, 24471, 120, 65).marginBase;
        const far = shortOptionMargin({ root: 'NIFTY', strike: 27000, optionType: 'CE' }, 24471, 10, 65).marginBase;
        expect(far).toBeLessThan(near);
    });
});

describe('persistence', () => {
    it('carries a book containing option positions forward without resetting it', () => {
        // This is the assertion that turns "do not wipe the book" from a comment into a
        // test. A version mismatch used to discard everything.
        const { state } = sell(fresh(), 65, 120);
        const round = migratePaperState(JSON.parse(JSON.stringify(state)));
        expect(round.reset).toBe(false);
        expect(round.state.positions[SYMBOL].creditBase).toBeCloseTo(65 * lastFillPrice(state), 6);
        expect(Math.abs(reconciliationError(round.state))).toBeLessThan(1e-6);
    });

    it('accepts a blob from a NEWER build rather than discarding it', () => {
        // A device that is behind must not destroy a book it merely cannot read yet.
        const { state } = buy(fresh(), 65, 120);
        const future = { ...state, version: PAPER_STATE_VERSION + 1 };
        expect(migratePaperState(future).reset).toBe(false);
        expect(isPaperState(future)).toBe(true);
    });

    it('still resets a v1 book, which genuinely cannot reconcile', () => {
        const { state } = buy(fresh(), 65, 120);
        expect(migratePaperState({ ...state, version: 1 }).reset).toBe(true);
    });
});
