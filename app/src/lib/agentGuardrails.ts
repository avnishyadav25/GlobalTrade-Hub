// Shared guardrail evaluation for every path that can turn an AI signal into an order.
//
// This exists because the checks used to live only inside the auto-trading loop:
// the Agents screen's "Trade →" button called place() directly and honoured just
// maxOrderValueINR, so a user could fire orders that the automatic path would have
// refused — while the same screen advertised the guardrails as enforced.

import { toBase, isFractional, marketOf, type PaperState, type FxRates } from './paperEngine';
import { sessionInfo, shouldSquareOff } from './sessions';
import type { Guardrails } from '@/stores/agentStore';
import type { LiveQuote } from '@/stores/marketStore';
import type { TradeSignal } from './ai/types';

export interface GuardrailVerdict {
    allowed: boolean;
    reason?: string;
}

/** Stable key used to avoid acting on the same signal twice. */
export function signalKey(sig: { symbol: string; side: string; entry?: number }): string {
    return `${sig.symbol}:${sig.side}:${Math.round(sig.entry ?? 0)}`;
}

/**
 * The minimum a signal must carry to be risk-checked.
 *
 * Deliberately structural rather than a union of TradeSignal | StrategySignal: the LLM
 * signal and the deterministic one are produced by unrelated code and should not have to
 * know about each other. Both satisfy this shape as-is.
 */
export interface GuardrailSignal {
    symbol: string;
    side: 'buy' | 'sell';
    /**
     * 0-100. ABSENT on rule-based signals, which have no such notion — and inventing one
     * would be a fabricated number sitting beside real ones. `minConfidence` is therefore
     * an LLM-only control and does not apply when this is undefined.
     */
    confidence?: number;
    /** Reference price. Only used to build the dedupe key. */
    entry?: number;
    /**
     * Whether this OPENS or CLOSES exposure. Defaults to 'enter', so the AI path — which
     * only ever opens — is unchanged.
     */
    intent?: 'enter' | 'exit';
}

/**
 * Clamp operator-entered guardrails into a sane range.
 * The inputs are raw `Number(e.target.value)`, so clearing a field yields 0 — which
 * previously made the sizing maths floor to "1 share" instead of blocking.
 */
export function normaliseGuardrails(g: Guardrails): Guardrails {
    const pos = (n: number, fallback: number) => (Number.isFinite(n) && n > 0 ? n : fallback);
    const nonNeg = (n: number | undefined, fallback: number) =>
        Number.isFinite(n) && (n as number) >= 0 ? (n as number) : fallback;
    return {
        maxOrderValueINR: pos(g.maxOrderValueINR, 0),
        maxDailyLossINR: pos(g.maxDailyLossINR, 0),
        maxOpenPositions: Math.max(0, Math.floor(Number.isFinite(g.maxOpenPositions) ? g.maxOpenPositions : 0)),
        minConfidence: Math.min(100, Math.max(0, Number.isFinite(g.minConfidence) ? g.minConfidence : 0)),
        // Newer limits default to OFF (0 = no cap) so an existing persisted store does
        // not suddenly start refusing orders after an upgrade.
        maxPerSymbolPct: Math.min(100, nonNeg(g.maxPerSymbolPct, 0)),
        maxOrdersPerDay: Math.floor(nonNeg(g.maxOrdersPerDay, 0)),
        squareOffBufferMin: Math.floor(nonNeg(g.squareOffBufferMin, 0)),
        tradeOnlyWhenOpen: g.tradeOnlyWhenOpen ?? false,
    };
}

/**
 * Combine a local guardrail set with one loaded from the server.
 *
 * Field-wise, local first, so that a key the SERVER ROW PREDATES survives instead of
 * reverting to undefined. Cloud sync used to replace the object wholesale, which meant a
 * row written before `maxPerSymbolPct`, `maxOrdersPerDay`, `squareOffBufferMin` and
 * `tradeOnlyWhenOpen` existed silently switched all four back off on the next reload —
 * a risk control turning itself off with nothing said.
 *
 * Keys the server actually carries still win, so multi-device sync is unchanged. Both
 * sides are untrusted, so the result always goes through `normaliseGuardrails`.
 */
export function mergeGuardrails(local: unknown, server: unknown): Guardrails {
    const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
    return normaliseGuardrails({ ...obj(local), ...obj(server) } as unknown as Guardrails);
}

/** Realized net loss (negative number) booked since local midnight. */
export function lossToday(state: PaperState, now = Date.now()): number {
    const startOfDay = new Date(now).setHours(0, 0, 0, 0);
    let loss = 0;
    for (const f of state.fills) {
        if (f.ts < startOfDay) continue;
        const net = f.pnl - f.fee;
        if (net < 0) loss += net;
    }
    return loss;
}

/** Orders placed since local midnight, from the order log rather than the fill log. */
export function ordersToday(state: PaperState, now = Date.now()): number {
    const startOfDay = new Date(now).setHours(0, 0, 0, 0);
    return state.orders.filter((o) => o.createdAt >= startOfDay && o.status !== 'rejected').length;
}

/**
 * Base-currency exposure already held in one instrument, as a fraction of equity.
 *
 * Uses the position's frozen cost basis rather than a live mark: the cap is about how
 * much was COMMITTED, and a position that has moved against you should not quietly free
 * up room to add to it.
 */
export function symbolExposurePct(state: PaperState, symbol: string, equityBase: number): number {
    if (!(equityBase > 0)) return 0;
    const p = state.positions[symbol];
    if (!p) return 0;
    return (Math.abs(p.basisBase) + Math.abs(p.marginHeldBase)) / equityBase * 100;
}

export interface GuardrailInput {
    guardrails: Guardrails;
    /** The book the limits are measured against. */
    book: PaperState;
    sig: GuardrailSignal;
    actedIds: string[];
    killSwitch: boolean;
    /** Equity in base currency, for the per-symbol exposure cap. */
    equityBase?: number;
    /** Injectable clock, so the daily and session rules are testable. */
    now?: number;
}

/** Every check that must pass before a signal becomes an order. */
export function checkGuardrails({ guardrails, book, sig, actedIds, killSwitch, equityBase, now = Date.now() }: GuardrailInput): GuardrailVerdict {
    if (killSwitch) return { allowed: false, reason: 'Kill-switch is on.' };

    const g = normaliseGuardrails(guardrails);

    // Does this signal ADD exposure? Every cap below except the session rules exists to
    // limit how much you can take on, so none of them may block a close.
    //
    // This distinction did not exist while the only caller was the AI path, which never
    // emits an exit. Applying those caps to an exit would be actively dangerous: at the
    // position limit, or past the daily loss limit, you would be unable to close the very
    // positions that put you there. A risk control that traps you in a losing trade is
    // not a risk control.
    const opening = (sig.intent ?? 'enter') === 'enter';

    if (opening && g.maxOrderValueINR <= 0) {
        return { allowed: false, reason: 'Max order value is not set — nothing can be sized.' };
    }

    // minConfidence is an LLM-only control: a rule-based signal has no confidence score,
    // and defaulting one would invent a number. Absent means "not applicable", while a
    // present-but-broken value (NaN from a bad model response) is still refused.
    if (sig.confidence !== undefined && (!Number.isFinite(sig.confidence) || sig.confidence < g.minConfidence)) {
        return { allowed: false, reason: `Confidence ${sig.confidence} is below the ${g.minConfidence} minimum.` };
    }

    // Only the AI path tracks acted-on keys; the deterministic path dedupes by signal id
    // in signalStore.push and passes an empty list here.
    if (actedIds.length && actedIds.includes(signalKey(sig))) {
        return { allowed: false, reason: 'This signal has already been acted on.' };
    }

    if (opening) {
        if (Object.keys(book.positions).length >= g.maxOpenPositions) {
            return { allowed: false, reason: `Already at the ${g.maxOpenPositions}-position limit.` };
        }
        if (g.maxDailyLossINR > 0 && -lossToday(book, now) >= g.maxDailyLossINR) {
            return { allowed: false, reason: `Daily loss limit of ₹${g.maxDailyLossINR.toLocaleString('en-IN')} reached.` };
        }
        if (g.maxOrdersPerDay > 0 && ordersToday(book, now) >= g.maxOrdersPerDay) {
            return { allowed: false, reason: `Already placed ${g.maxOrdersPerDay} orders today.` };
        }

        // Concentration. The position limit counts instruments; this one counts money, and
        // a book of eight positions all in the same name passes the first and fails this.
        if (g.maxPerSymbolPct > 0 && equityBase != null) {
            const held = symbolExposurePct(book, sig.symbol, equityBase);
            if (held >= g.maxPerSymbolPct) {
                return { allowed: false, reason: `${sig.symbol} is already ${held.toFixed(0)}% of equity, at the ${g.maxPerSymbolPct}% cap.` };
            }
        }
    }

    // Session rules apply to BOTH directions: a market that is shut cannot fill an order
    // in either direction, so this is physics rather than a risk appetite.
    const market = marketOf(sig.symbol);
    const session = sessionInfo(market, now);
    if (g.tradeOnlyWhenOpen && !session.open) {
        return { allowed: false, reason: `${session.label} is closed (${session.reason ?? 'outside hours'}).` };
    }
    // The square-off buffer is explicitly about NEW intraday positions — squaring off IS
    // an exit, so blocking exits here would defeat the rule's own purpose.
    if (opening && g.squareOffBufferMin > 0 && shouldSquareOff(market, now, g.squareOffBufferMin)) {
        return { allowed: false, reason: `Within ${g.squareOffBufferMin} minutes of the close — no new intraday positions.` };
    }

    return { allowed: true };
}

/**
 * Size an order to the max-order-value guardrail, in the instrument's own units.
 * Returns 0 when no valid size exists — callers must treat that as "do not trade"
 * rather than falling back to a single unit.
 */
export function sizeFromGuardrails(
    symbol: string,
    price: number,
    guardrails: Guardrails,
    fx: FxRates
): number {
    const g = normaliseGuardrails(guardrails);
    if (!(price > 0) || g.maxOrderValueINR <= 0) return 0;
    const unitCostBase = toBase(symbol, price, fx);
    if (!(unitCostBase > 0)) return 0;
    const raw = g.maxOrderValueINR / unitCostBase;
    if (isFractional(symbol)) {
        const q = +raw.toFixed(6);
        return q > 0 ? q : 0;
    }
    return Math.floor(raw); // 0 when one unit already exceeds the cap — do not round up
}

/** Convenience: resolve the live price for a signal from the quote map. */
export function priceForSignal(sig: TradeSignal, quotes: Record<string, LiveQuote>): number {
    return quotes[sig.symbol]?.price ?? sig.entry;
}
