import { describe, it, expect } from 'vitest';
import {
    checkGuardrails, normaliseGuardrails, sizeFromGuardrails, signalKey,
    lossToday, ordersToday, symbolExposurePct, priceForSignal,
} from './agentGuardrails';
import { newPaperState, placeOrder, DEFAULT_FX, type PaperState } from './paperEngine';
import type { Guardrails } from '@/stores/agentStore';
import type { TradeSignal } from './ai/types';
import type { LiveQuote } from '@/stores/marketStore';

// The first tests this module has ever had, despite being the boundary every automated
// order passes through.

const GUARDS: Guardrails = {
    maxOrderValueINR: 100_000,
    maxDailyLossINR: 25_000,
    maxOpenPositions: 8,
    minConfidence: 60,
    maxPerSymbolPct: 0,
    maxOrdersPerDay: 0,
    squareOffBufferMin: 0,
    tradeOnlyWhenOpen: false,
};

const sig = (over: Partial<TradeSignal> = {}): TradeSignal => ({
    symbol: 'AAPL', side: 'buy', entry: 200, stop: 190, target: 220,
    confidence: 80, rationale: 'test', ...over,
});

const quote = (symbol: string, price: number): LiveQuote => ({
    symbol, price, prevClose: price, change: 0, changePercent: 0,
    high: price, low: price, volume: 0, ts: 0, dir: null, real: true,
});

/** Wednesday 11:00 New York — NYSE open. */
const US_OPEN = Date.UTC(2026, 7, 12, 15, 0);
/** Saturday — every equity market shut. */
const WEEKEND = Date.UTC(2026, 7, 15, 15, 0);

const check = (over: Partial<Parameters<typeof checkGuardrails>[0]> = {}) =>
    checkGuardrails({
        guardrails: GUARDS,
        book: newPaperState(500_000, 0),
        sig: sig(),
        actedIds: [],
        killSwitch: false,
        equityBase: 500_000,
        now: US_OPEN,
        ...over,
    });

/**
 * Build a book holding a real position.
 *
 * Throws if the fixture order is refused. Silently returning an empty book made five
 * tests pass their setup and then fail their assertion for reasons that had nothing to
 * do with what they were testing.
 */
function withPosition(symbol: string, qty: number, price: number, ts = Date.now()): PaperState {
    const start = newPaperState(500_000, ts);
    const { state, result } = placeOrder(
        start,
        { symbol, side: 'buy', type: 'market', qty },
        quote(symbol, price),
        DEFAULT_FX,
        ts
    );
    if (result.status === 'rejected') {
        throw new Error(`fixture order was refused: ${result.reason}`);
    }
    return state;
}

describe('the existing checks', () => {
    it('allows a well-formed signal', () => {
        expect(check().allowed).toBe(true);
    });

    it('refuses everything when the kill switch is on', () => {
        expect(check({ killSwitch: true })).toMatchObject({ allowed: false });
    });

    it('refuses when the order value cap is unset, rather than sizing to one unit', () => {
        expect(check({ guardrails: { ...GUARDS, maxOrderValueINR: 0 } }).allowed).toBe(false);
    });

    it('refuses a signal below the confidence floor', () => {
        expect(check({ sig: sig({ confidence: 10 }) }).allowed).toBe(false);
        expect(check({ sig: sig({ confidence: Number.NaN }) }).allowed).toBe(false);
    });

    it('refuses a signal already acted on', () => {
        expect(check({ actedIds: [signalKey(sig())] }).allowed).toBe(false);
    });

    it('refuses at the open-position limit', () => {
        expect(check({ guardrails: { ...GUARDS, maxOpenPositions: 0 } }).allowed).toBe(false);
    });
});

describe('signalKey', () => {
    it('is stable for the same signal and distinct across side and price', () => {
        expect(signalKey(sig())).toBe(signalKey(sig()));
        expect(signalKey(sig({ side: 'sell' }))).not.toBe(signalKey(sig()));
        expect(signalKey(sig({ entry: 300 }))).not.toBe(signalKey(sig()));
    });

    it('ignores sub-rupee entry differences, so a re-quote is the same signal', () => {
        expect(signalKey(sig({ entry: 200.4 }))).toBe(signalKey(sig({ entry: 200.1 })));
    });
});

describe('normaliseGuardrails', () => {
    it('treats a cleared field as zero rather than NaN', () => {
        const g = normaliseGuardrails({ ...GUARDS, maxOrderValueINR: Number.NaN, minConfidence: Number.NaN });
        expect(g.maxOrderValueINR).toBe(0);
        expect(g.minConfidence).toBe(0);
    });

    it('clamps confidence to 0-100 and refuses negative caps', () => {
        expect(normaliseGuardrails({ ...GUARDS, minConfidence: 500 }).minConfidence).toBe(100);
        expect(normaliseGuardrails({ ...GUARDS, maxPerSymbolPct: -5 }).maxPerSymbolPct).toBe(0);
    });

    it('defaults the newer limits to OFF, so an upgrade cannot silently start refusing', () => {
        const legacy = { maxOrderValueINR: 100_000, maxDailyLossINR: 25_000, maxOpenPositions: 8, minConfidence: 60 } as Guardrails;
        const g = normaliseGuardrails(legacy);
        expect(g.maxPerSymbolPct).toBe(0);
        expect(g.maxOrdersPerDay).toBe(0);
        expect(g.squareOffBufferMin).toBe(0);
        expect(g.tradeOnlyWhenOpen).toBe(false);
    });
});

describe('per-symbol exposure cap', () => {
    // 100 RELIANCE at ₹1,327 is ~₹1.33L — about 26% of a ₹5L account, and affordable.
    const heldInReliance = () => withPosition('RELIANCE', 100, 1327);
    const relianceSignal = sig({ symbol: 'RELIANCE', entry: 1327 });

    it('measures concentration in one instrument as a share of equity', () => {
        const book = heldInReliance();
        expect(symbolExposurePct(book, 'RELIANCE', 500_000)).toBeGreaterThan(20);
        expect(symbolExposurePct(book, 'TSLA', 500_000)).toBe(0);
    });

    it('refuses to add to a name already at the cap', () => {
        const verdict = check({
            book: heldInReliance(), sig: relianceSignal,
            guardrails: { ...GUARDS, maxPerSymbolPct: 20, maxOpenPositions: 10 },
        });
        expect(verdict.allowed).toBe(false);
        expect(verdict.reason).toMatch(/RELIANCE is already/);
    });

    it('catches concentration the position count cannot', () => {
        // A book of positions all in one name passes a position limit and fails this.
        const book = heldInReliance();
        expect(check({ book, sig: relianceSignal, guardrails: { ...GUARDS, maxOpenPositions: 10, maxPerSymbolPct: 0 } }).allowed).toBe(true);
        expect(check({ book, sig: relianceSignal, guardrails: { ...GUARDS, maxOpenPositions: 10, maxPerSymbolPct: 20 } }).allowed).toBe(false);
    });

    it('leaves an unrelated instrument alone', () => {
        const verdict = check({
            book: heldInReliance(), sig: sig({ symbol: 'TSLA' }),
            guardrails: { ...GUARDS, maxPerSymbolPct: 20, maxOpenPositions: 10 },
        });
        expect(verdict.allowed).toBe(true);
    });
});

describe('daily caps', () => {
    it('counts only orders placed since local midnight, excluding rejections', () => {
        const book = withPosition('AAPL', 1, 200);
        expect(ordersToday(book, Date.now())).toBe(1);
        // Two days later, that order is no longer "today".
        expect(ordersToday(book, Date.now() + 2 * 86_400_000)).toBe(0);
    });

    it('refuses once the daily order cap is reached', () => {
        const book = withPosition('AAPL', 1, 200);
        const verdict = check({ book, sig: sig({ symbol: 'TSLA' }), guardrails: { ...GUARDS, maxOrdersPerDay: 1 }, now: Date.now() });
        expect(verdict.allowed).toBe(false);
        expect(verdict.reason).toMatch(/orders today/);
    });

    it('reports no loss on a fresh book', () => {
        expect(lossToday(newPaperState(500_000, 0))).toBe(0);
    });
});

describe('session rules', () => {
    it('refuses when the market is shut, if asked to', () => {
        const verdict = check({ guardrails: { ...GUARDS, tradeOnlyWhenOpen: true }, now: WEEKEND });
        expect(verdict.allowed).toBe(false);
        expect(verdict.reason).toMatch(/closed/);
    });

    it('allows during the session', () => {
        expect(check({ guardrails: { ...GUARDS, tradeOnlyWhenOpen: true }, now: US_OPEN }).allowed).toBe(true);
    });

    it('never blocks crypto, which has no close', () => {
        const verdict = check({ sig: sig({ symbol: 'BTC/USDT' }), guardrails: { ...GUARDS, tradeOnlyWhenOpen: true }, now: WEEKEND });
        expect(verdict.allowed).toBe(true);
    });

    it('refuses a new intraday position inside the square-off buffer', () => {
        // 15:50 New York — ten minutes before the close.
        const nearClose = Date.UTC(2026, 7, 12, 19, 50);
        const verdict = check({ guardrails: { ...GUARDS, squareOffBufferMin: 15 }, now: nearClose });
        expect(verdict.allowed).toBe(false);
        expect(verdict.reason).toMatch(/minutes of the close/);
    });

    it('allows earlier in the same session', () => {
        expect(check({ guardrails: { ...GUARDS, squareOffBufferMin: 15 }, now: US_OPEN }).allowed).toBe(true);
    });
});

describe('sizeFromGuardrails', () => {
    it('sizes to the order-value cap', () => {
        // ₹1,00,000 cap, AAPL at $200 -> about ₹19,060 per share at the fallback rate.
        const qty = sizeFromGuardrails('AAPL', 200, GUARDS, DEFAULT_FX);
        expect(qty).toBe(Math.floor(100_000 / (200 * DEFAULT_FX.USD)));
    });

    it('returns 0 rather than rounding up when one unit exceeds the cap', () => {
        expect(sizeFromGuardrails('AAPL', 200, { ...GUARDS, maxOrderValueINR: 100 }, DEFAULT_FX)).toBe(0);
    });

    it('allows a fractional quantity where the instrument permits it', () => {
        const qty = sizeFromGuardrails('BTC/USDT', 60_000, GUARDS, DEFAULT_FX);
        expect(qty).toBeGreaterThan(0);
        expect(Number.isInteger(qty)).toBe(false);
    });

    it('returns 0 for a nonsensical price or an unset cap', () => {
        expect(sizeFromGuardrails('AAPL', 0, GUARDS, DEFAULT_FX)).toBe(0);
        expect(sizeFromGuardrails('AAPL', -1, GUARDS, DEFAULT_FX)).toBe(0);
        expect(sizeFromGuardrails('AAPL', 200, { ...GUARDS, maxOrderValueINR: 0 }, DEFAULT_FX)).toBe(0);
    });
});

describe('priceForSignal', () => {
    it('prefers the live quote over the signalentry price', () => {
        expect(priceForSignal(sig(), { AAPL: quote('AAPL', 250) })).toBe(250);
    });

    it('falls back to the signal entry when nothing is quoted', () => {
        expect(priceForSignal(sig(), {})).toBe(200);
    });
});
