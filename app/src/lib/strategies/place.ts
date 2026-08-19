'use client';

import { usePaperStore } from '@/stores/paperStore';
import { useMarketStore } from '@/stores/marketStore';
import { useSignalStore, type QueuedSignal } from '@/stores/signalStore';
import { useStrategyStore } from '@/stores/strategyStore';
import { useAgentStore } from '@/stores/agentStore';
import { deriveFxRates, equity, isFractional, toBase } from '@/lib/paperEngine';
import { sizeForSignal } from './runtime';

// Turning an approved signal into an order.
//
// ONE path, used by both the approval queue and the auto runner, so a strategy running
// unattended cannot behave differently from one you clicked. And it goes through
// `usePaperStore.place()` — the single chokepoint — which is what applies the kill
// switch and the coach rules, and what RECORDS a refusal on the Orders screen instead
// of letting it vanish into a toast.

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
