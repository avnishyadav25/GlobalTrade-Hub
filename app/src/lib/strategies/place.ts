'use client';

import { usePaperStore } from '@/stores/paperStore';
import { useMarketStore } from '@/stores/marketStore';
import { useSignalStore, type QueuedSignal } from '@/stores/signalStore';
import { useStrategyStore } from '@/stores/strategyStore';
import { useAgentStore } from '@/stores/agentStore';
import { deriveFxRates, equity, isFractional, toBase } from '@/lib/paperEngine';
import { checkGuardrails } from '@/lib/agentGuardrails';
import { sizeForSignal } from './runtime';

// Turning an approved signal into an order.
//
// ONE path, used by both the approval queue and the auto runner, so a strategy running
// unattended cannot behave differently from one you clicked. And it goes through
// `usePaperStore.place()` — the single chokepoint — which is what applies the kill
// switch and the coach rules, and what RECORDS a refusal on the Orders screen instead
// of letting it vanish into a toast.
//
// It ALSO runs `checkGuardrails`, the same module the LLM path uses. Before that, this
// path honoured only the kill switch, the coach rules, and the order-value cap: a
// deterministic strategy left on `auto` had no daily-loss limit, no position cap, no
// orders-per-day cap, no concentration cap and no market-hours check — while the Agents
// screen presented those limits as if they governed automation generally. That is the
// same defect this file's sibling `agentGuardrails.ts` was written to fix for the AI
// path, and it existed here in mirror image. One module, both paths, no second
// implementation to drift.

export interface PlaceOutcome {
    ok: boolean;
    qty: number;
    reason?: string;
}

export function placeSignal(signal: QueuedSignal): PlaceOutcome {
    const market = useMarketStore.getState();
    const paper = usePaperStore.getState();
    const agent = useAgentStore.getState();
    const strategies = useStrategyStore.getState();
    const signals = useSignalStore.getState();

    const fail = (reason: string): PlaceOutcome => {
        signals.setStatus(signal.id, 'rejected', { rejectReason: reason });
        return { ok: false, qty: 0, reason };
    };

    if (agent.killSwitch) return fail('Kill-switch is on — all order placement is halted.');

    const quote = market.getQuote(signal.symbol);
    const price = quote?.price;
    // Never size from the signal's own reference price: it is the close of the bar that
    // triggered it, and by the time you approve it the market has moved.
    if (!price || price <= 0) return fail('No live price for this instrument — refusing to size from a stale reference.');

    const fx = deriveFxRates(market.quotes);
    const equityBase = equity(paper.state, market.quotes, fx);
    const priceBase = toBase(signal.symbol, price, fx);

    // Exposure caps apply to opening only — checkGuardrails reads `signal.intent`, so an
    // exit is never blocked by the position count or the daily loss limit. Being unable
    // to close the trade that breached a limit would be the opposite of a risk control.
    // `actedIds` is empty because this path already dedupes by signal id in
    // `signalStore.push`.
    const verdict = checkGuardrails({
        guardrails: agent.guardrails,
        book: paper.state,
        sig: signal,
        actedIds: [],
        killSwitch: agent.killSwitch,
        equityBase,
    });
    if (!verdict.allowed) return fail(verdict.reason ?? 'Blocked by your guardrails.');

    const qty =
        signal.intent === 'exit'
            ? Math.abs(paper.state.positions[signal.symbol]?.qty ?? 0)
            : sizeForSignal({
                  signal,
                  equityBase,
                  priceBase,
                  riskPct: strategies.riskPct,
                  fractional: isFractional(signal.symbol),
                  maxOrderValueBase: agent.guardrails.maxOrderValueINR,
              });

    if (!(qty > 0)) {
        return fail(
            signal.intent === 'exit'
                ? 'Nothing open in this instrument to close.'
                : 'Position size worked out at zero — the order value cap is too small for one unit.'
        );
    }

    const result = paper.place({ symbol: signal.symbol, side: signal.side, type: 'market', qty });
    if (result.status === 'rejected') {
        return fail(result.reason ?? 'Rejected by the order chokepoint.');
    }

    signals.setStatus(signal.id, 'placed', { qty });
    return { ok: true, qty };
}
