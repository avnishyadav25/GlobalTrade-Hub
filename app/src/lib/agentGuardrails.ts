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
export function signalKey(sig: TradeSignal): string {
    return `${sig.symbol}:${sig.side}:${Math.round(sig.entry)}`;
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
    sig: TradeSignal;
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

    if (g.maxOrderValueINR <= 0) {
        return { allowed: false, reason: 'Max order value is not set — nothing can be sized.' };
    }
    if (!Number.isFinite(sig.confidence) || sig.confidence < g.minConfidence) {
        return { allowed: false, reason: `Confidence ${sig.confidence} is below the ${g.minConfidence} minimum.` };
    }
    if (actedIds.includes(signalKey(sig))) {
        return { allowed: false, reason: 'This signal has already been acted on.' };
    }
    if (Object.keys(book.positions).length >= g.maxOpenPositions) {
        return { allowed: false, reason: `Already at the ${g.maxOpenPositions}-position limit.` };
    }
    if (g.maxDailyLossINR > 0 && -lossToday(book, now) >= g.maxDailyLossINR) {
        return { allowed: false, reason: `Daily loss limit of ₹${g.maxDailyLossINR.toLocaleString('en-IN')} reached.` };
    }
    if (g.maxOrdersPerDay > 0 && ordersToday(book, now) >= g.maxOrdersPerDay) {
        return { allowed: false, reason: `Already placed ${g.maxOrdersPerDay} orders today.` };
    }

    // Concentration. The position limit counts instruments; this one counts money, and a
    // book of eight positions all in the same name passes the first and fails this.
    if (g.maxPerSymbolPct > 0 && equityBase != null) {
        const held = symbolExposurePct(book, sig.symbol, equityBase);
        if (held >= g.maxPerSymbolPct) {
            return { allowed: false, reason: `${sig.symbol} is already ${held.toFixed(0)}% of equity, at the ${g.maxPerSymbolPct}% cap.` };
        }
    }

    // Session rules. A market that is shut cannot fill an order, and an intraday
    // position opened minutes before the close will be squared off by the broker — at
    // its price, with its charges.
    const market = marketOf(sig.symbol);
    const session = sessionInfo(market, now);
    if (g.tradeOnlyWhenOpen && !session.open) {
        return { allowed: false, reason: `${session.label} is closed (${session.reason ?? 'outside hours'}).` };
    }
    if (g.squareOffBufferMin > 0 && shouldSquareOff(market, now, g.squareOffBufferMin)) {
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
