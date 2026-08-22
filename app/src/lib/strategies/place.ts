'use client';

import { usePaperStore } from '@/stores/paperStore';
import { useMarketStore } from '@/stores/marketStore';
import { useSignalStore, type QueuedSignal } from '@/stores/signalStore';
import { useStrategyStore } from '@/stores/strategyStore';
import { useAgentStore } from '@/stores/agentStore';
import { assessSignal } from '@/lib/automation/decide';

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

    // Guardrails and sizing live in lib/automation/decide.ts, shared verbatim with the
    // server runner. Two copies of this logic would mean a strategy could size
    // differently, or apply a different cap, depending on whether a browser tab happened
    // to be open — divergence that would be invisible until the books disagreed.
    const assessment = assessSignal({
        signal,
        instanceId: signal.instanceId,
        book: paper.state,
        quotes: market.quotes,
        guardrails: agent.guardrails,
        riskPct: strategies.riskPct,
    });
    if (!assessment.ok) return fail(assessment.reason);

    const { qty, source } = assessment;
    const result = paper.place({ symbol: signal.symbol, side: signal.side, type: 'market', qty, source });
    if (result.status === 'rejected') {
        return fail(result.reason ?? 'Rejected by the order chokepoint.');
    }

    signals.setStatus(signal.id, 'placed', { qty });
    return { ok: true, qty };
}
