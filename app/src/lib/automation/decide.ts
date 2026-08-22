// The shared decision core.
//
// Automation runs in two places — the browser loop in StrategyEngine, and the server
// runner behind a self-hosted scheduler. They cannot share a COMMIT path: the browser
// goes through `usePaperStore.place()` (Zustand, coach rules, kill switch), the server
// calls `placeOrder()` from paperEngine directly against a book loaded from Supabase.
//
// What they must share is the DECISION, because that is where divergence would be
// invisible and expensive: a strategy that sizes differently, or applies a different
// guardrail, depending on whether your laptop lid was open. Everything up to and
// including "how many units, and is that allowed" lives here and is pure.

import { checkGuardrails, type GuardrailVerdict } from '@/lib/agentGuardrails';
import { deriveFxRates, equity, isFractional, toBase, type PaperState, type FxRates, type OrderSource } from '@/lib/paperEngine';
import { sizeForSignal, type StrategySignal } from '@/lib/strategies/runtime';
import type { Guardrails } from '@/stores/agentStore';
import type { LiveQuote } from '@/stores/marketStore';

export interface AssessInput {
    signal: StrategySignal;
    /** Which running instance produced it, for provenance. */
    instanceId: string;
    book: PaperState;
    quotes: Record<string, LiveQuote>;
    guardrails: Guardrails;
    riskPct: number;
    /** Signal ids either runner has already acted on, so a handover cannot duplicate. */
    actedSignalIds?: string[];
    now?: number;
    /** Injectable so a caller that already derived rates does not derive them twice. */
    fx?: FxRates;
}

export type Assessment =
    | { ok: true; qty: number; price: number; source: OrderSource }
    | { ok: false; reason: string };

/**
 * Everything between "a strategy wants to trade" and "place this many units".
 *
 * Extracted verbatim from `lib/strategies/place.ts`, which remains the browser's commit
 * wrapper. Keeping one copy is the point: guardrails and sizing are exactly the logic
 * that must not depend on which runner is awake.
 */
export function assessSignal(input: AssessInput): Assessment {
    const { signal, instanceId, book, quotes, guardrails, riskPct, actedSignalIds, now = Date.now() } = input;

    // A handover duplicate. Signal ids are deterministic, so the runner taking over
    // derives the same id for the same bar; runtime memory is never persisted, so
    // without this it would re-place an order the other runner just made.
    if (actedSignalIds?.includes(signal.id)) {
        return { ok: false, reason: 'Already acted on by the other runner.' };
    }

    const price = quotes[signal.symbol]?.price;
    // Never size from the signal's own reference price: it is the close of the bar that
    // triggered it, and the market has moved since.
    if (!price || price <= 0) {
        return { ok: false, reason: 'No live price for this instrument — refusing to size from a stale reference.' };
    }

    const fx = input.fx ?? deriveFxRates(quotes);
    const equityBase = equity(book, quotes, fx);
    const priceBase = toBase(signal.symbol, price, fx);

    const verdict: GuardrailVerdict = checkGuardrails({
        guardrails,
        book,
        sig: signal,
        actedIds: [],
        killSwitch: false,   // the caller's own kill switch check runs at its commit point
        equityBase,
        now,
    });
    if (!verdict.allowed) return { ok: false, reason: verdict.reason ?? 'Blocked by your guardrails.' };

    const qty =
        signal.intent === 'exit'
            ? Math.abs(book.positions[signal.symbol]?.qty ?? 0)
            : sizeForSignal({
                  signal,
                  equityBase,
                  priceBase,
                  riskPct,
                  fractional: isFractional(signal.symbol),
                  maxOrderValueBase: guardrails.maxOrderValueINR,
              });

    if (!(qty > 0)) {
        return {
            ok: false,
            reason:
                signal.intent === 'exit'
                    ? 'Nothing open in this instrument to close.'
                    : 'Position size worked out at zero — the order value cap is too small for one unit.',
        };
    }

    return {
        ok: true,
        qty,
        price,
        source: { kind: 'strategy', strategyId: signal.strategyId, instanceId },
    };
}
