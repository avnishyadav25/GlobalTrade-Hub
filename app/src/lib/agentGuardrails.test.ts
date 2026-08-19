import { describe, it, expect } from 'vitest';
import {
    checkGuardrails, normaliseGuardrails, sizeFromGuardrails, signalKey,
    lossToday, ordersToday, symbolExposurePct, priceForSignal, mergeGuardrails,
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

// ---------------------------------------------------------------------------------
// The deterministic (rule-based) path.
//
// Until this module became the single risk regime, `lib/strategies/place.ts` honoured
// only the kill switch, the coach rules and the order-value cap. These tests pin the two
// things that had to be true before it could be routed through here.

/** A rule-based signal: no confidence score, and an explicit intent. */
const ruleSig = (over: Partial<{ symbol: string; side: 'buy' | 'sell'; intent: 'enter' | 'exit' }> = {}) =>
    ({ symbol: 'RELIANCE', side: 'buy' as const, intent: 'enter' as const, ...over });

/** A book carrying a realised loss big enough to breach the daily limit. */
function withRealisedLoss(ts = US_OPEN): PaperState {
    const held = withPosition('RELIANCE', 100, 1327, ts);
    const { state, result } = placeOrder(
        held,
        { symbol: 'RELIANCE', side: 'sell', type: 'market', qty: 100 },
        quote('RELIANCE', 1000),
        DEFAULT_FX,
        ts
    );
    if (result.status === 'rejected') throw new Error(`fixture close was refused: ${result.reason}`);
    return state;
}

describe('rule-based signals carry no confidence', () => {
    it('does not apply minConfidence when there is no score', () => {
        // The old check was `!Number.isFinite(sig.confidence)`, which refused every
        // deterministic signal outright. Absent must mean "not applicable", not zero.
        expect(check({ sig: ruleSig() }).allowed).toBe(true);
    });

    it('still refuses an LLM signal whose score is broken', () => {
        expect(check({ sig: sig({ confidence: Number.NaN }) }).allowed).toBe(false);
    });

    it('binds a rule-based signal to the position limit when opening', () => {
        const verdict = check({
            sig: ruleSig({ symbol: 'AAPL' }),
            book: withPosition('RELIANCE', 100, 1327),
            guardrails: { ...GUARDS, maxOpenPositions: 1 },
        });
        expect(verdict.allowed).toBe(false);
        expect(verdict.reason).toMatch(/position limit/);
    });
});

describe('exits are never blocked by an exposure cap', () => {
    // Every cap here limits how much you may TAKE ON. Applying them to a close would
    // trap you in the exact position that breached the limit.
    const exit = ruleSig({ intent: 'exit' });

    it('lets you close at the position limit', () => {
        const verdict = check({
            sig: exit,
            book: withPosition('RELIANCE', 100, 1327),
            guardrails: { ...GUARDS, maxOpenPositions: 1 },
        });
        expect(verdict.allowed).toBe(true);
    });

    it('lets you close after the daily loss limit is breached', () => {
        const book = withRealisedLoss();
        // Guard the fixture: if this book is not actually past the limit, the assertion
        // below would pass for the wrong reason.
        expect(-lossToday(book, US_OPEN)).toBeGreaterThan(GUARDS.maxDailyLossINR);
        expect(check({ sig: exit, book, now: US_OPEN }).allowed).toBe(true);
        // ...and the same book still refuses to OPEN.
        expect(check({ sig: ruleSig(), book, now: US_OPEN }).allowed).toBe(false);
    });

    it('lets you close after the daily order count is spent', () => {
        const book = withPosition('RELIANCE', 100, 1327, US_OPEN);
        const guardrails = { ...GUARDS, maxOrdersPerDay: 1 };
        expect(check({ sig: exit, book, guardrails, now: US_OPEN }).allowed).toBe(true);
        expect(check({ sig: ruleSig(), book, guardrails, now: US_OPEN }).allowed).toBe(false);
    });

    it('lets you close a position that is over the concentration cap', () => {
        const book = withPosition('RELIANCE', 100, 1327);
        const guardrails = { ...GUARDS, maxPerSymbolPct: 1 };
        expect(check({ sig: exit, book, guardrails }).allowed).toBe(true);
        expect(check({ sig: ruleSig(), book, guardrails }).allowed).toBe(false);
    });

    it('lets you square off inside the square-off buffer', () => {
        // The rule is "no NEW intraday positions near the close" — blocking the exit
        // would defeat its own purpose.
        const guardrails = { ...GUARDS, squareOffBufferMin: 600 };
        // Paired assertion: without proving the ENTER is refused, this test would pass
        // just as happily if the buffer never triggered at all.
        expect(check({ sig: ruleSig({ symbol: 'AAPL' }), guardrails, now: US_OPEN }).allowed).toBe(false);
        expect(check({ sig: ruleSig({ symbol: 'AAPL', intent: 'exit' }), guardrails, now: US_OPEN }).allowed).toBe(true);
    });

    it('lets you close even with no order-value cap set', () => {
        // Exit size comes from the open position, not from the cap.
        expect(check({ sig: exit, guardrails: { ...GUARDS, maxOrderValueINR: 0 } }).allowed).toBe(true);
    });

    it('still refuses an exit when the market is shut, which is physics not risk', () => {
        const verdict = check({ sig: exit, guardrails: { ...GUARDS, tradeOnlyWhenOpen: true }, now: WEEKEND });
        expect(verdict.allowed).toBe(false);
        expect(verdict.reason).toMatch(/closed/);
    });

    it('still refuses everything when the kill switch is on', () => {
        expect(check({ sig: exit, killSwitch: true }).allowed).toBe(false);
    });
});

describe('merging guardrails across devices', () => {
    // Cloud sync used to replace the guardrail object wholesale with the server's copy.
    // A row written before the four newer caps existed has no such keys, so every reload
    // silently switched them back off. Reproduced in a browser before this was fixed:
    // set TRADE ONLY WHEN OPEN, reload, and it is off again with nothing said.
    const OLD_SERVER_ROW = {
        maxOrderValueINR: 100_000,
        maxDailyLossINR: 25_000,
        maxOpenPositions: 8,
        minConfidence: 60,
    };

    it('keeps local caps the server row predates', () => {
        const local: Guardrails = { ...GUARDS, tradeOnlyWhenOpen: true, maxOrdersPerDay: 5, maxPerSymbolPct: 20, squareOffBufferMin: 15 };
        const merged = mergeGuardrails(local, OLD_SERVER_ROW);
        expect(merged.tradeOnlyWhenOpen).toBe(true);
        expect(merged.maxOrdersPerDay).toBe(5);
        expect(merged.maxPerSymbolPct).toBe(20);
        expect(merged.squareOffBufferMin).toBe(15);
    });

    it('still lets the server win on keys it actually carries', () => {
        // Otherwise multi-device sync would stop working, which is the opposite failure.
        const local: Guardrails = { ...GUARDS, maxOpenPositions: 2 };
        expect(mergeGuardrails(local, OLD_SERVER_ROW).maxOpenPositions).toBe(8);
    });

    it('normalises the result, so a malformed row cannot produce undefined caps', () => {
        const merged = mergeGuardrails(GUARDS, { maxOpenPositions: 'nonsense', minConfidence: 999 });
        expect(Number.isFinite(merged.maxOpenPositions)).toBe(true);
        expect(merged.minConfidence).toBeLessThanOrEqual(100);
        expect(merged.maxOrderValueINR).toBeGreaterThan(0);
    });

    it('survives null or non-object input from either side', () => {
        expect(() => mergeGuardrails(null, undefined)).not.toThrow();
        expect(Number.isFinite(mergeGuardrails(null, undefined).maxOpenPositions)).toBe(true);
        expect(mergeGuardrails(GUARDS, 'garbage').maxOpenPositions).toBe(8);
    });
});
