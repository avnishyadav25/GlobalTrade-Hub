'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useStrategyStore } from '@/stores/strategyStore';
import { useSignalStore } from '@/stores/signalStore';
import { usePaperStore } from '@/stores/paperStore';
import { useMarketStore } from '@/stores/marketStore';
import { useAgentStore } from '@/stores/agentStore';
import { strategyById } from '@/lib/strategies/defs';
import { evaluateStrategy } from '@/lib/strategies/runtime';
import { placeSignal } from '@/lib/strategies/place';
import { candlesUrl } from '@/lib/marketData/candlesUrl';
import { marketOf } from '@/lib/paperEngine';
import { sessionInfo } from '@/lib/sessions';
import type { Candle } from '@/lib/mockData';

/**
 * Runs enabled strategies against live data.
 *
 * Deterministic — no LLM anywhere in this path. It evaluates against candles from the
 * SAME endpoint the backtester uses, rather than resampling quote ticks, so a live
 * signal and a backtested signal are looking at identical bars. Anything else would
 * make a backtest unable to say anything about live behaviour.
 */

const CYCLE_MS = 60_000;
/** Bars requested per instance. Enough for a 200-bar warm-up plus room to look back. */
const BAR_LIMIT = 400;

const TIMEFRAME_SECONDS: Record<string, number> = {
    '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400,
};

export function StrategyEngine() {
    useEffect(() => {
        let active = true;

        const tick = async () => {
            useSignalStore.getState().expireStale();

            const store = useStrategyStore.getState();
            const instances = store.activeInstances();
            if (!instances.length) return;

            // The kill switch stops evaluation entirely, not just placement. A queue
            // filling up while trading is halted is noise you would have to clear later.
            if (useAgentStore.getState().killSwitch) return;

            const guardrails = useAgentStore.getState().guardrails;

            for (const instance of instances) {
                if (!active) return;
                const strategy = strategyById(instance.strategyId);
                if (!strategy || strategy.signalOnly) continue;

                // Skip a shut market BEFORE spending a candle fetch on it. With three
                // markets on a 60-second loop this is most of the request budget, and
                // the resulting order would be refused by checkGuardrails anyway. Gated
                // on the guardrail so that turning it off still evaluates out of hours,
                // which is what someone watching signals overnight expects.
                if (guardrails.tradeOnlyWhenOpen && !sessionInfo(marketOf(instance.symbol)).open) continue;

                const barSeconds = TIMEFRAME_SECONDS[instance.timeframe] ?? 86_400;
                let bars: Candle[] = [];
                try {
                    const quote = useMarketStore.getState().quotes[instance.symbol];
                    const res = await fetch(candlesUrl(instance.symbol, instance.timeframe, BAR_LIMIT, quote?.price));
                    if (!res.ok) continue;
                    const data = await res.json();
                    // A generated series is not a basis for a live order.
                    if (data?.synthetic) continue;
                    bars = data?.candles ?? [];
                } catch {
                    continue;
                }
                if (bars.length < 10) continue;

                const paper = usePaperStore.getState().state;
                const held = paper.positions[instance.symbol];

                const { signal, memory } = evaluateStrategy({
                    strategy,
                    params: instance.params,
                    symbol: instance.symbol,
                    market: marketOf(instance.symbol),
                    timeframe: instance.timeframe,
                    barSeconds,
                    bars,
                    position: held
                        ? { qty: held.qty, avgPrice: held.avgPrice, entryIndex: bars.length - 1 }
                        : null,
                    equity: paper.account.cash,
                    memory: useStrategyStore.getState().memory[instance.id] ?? {},
                });

                useStrategyStore.getState().setMemory(instance.id, memory);
                if (!signal) continue;

                const auto = instance.mode === 'auto';
                const added = useSignalStore.getState().push({
                    ...signal,
                    instanceId: instance.id,
                    status: auto ? 'approved' : 'pending',
                    auto,
                });
                if (!added) continue;

                if (auto) {
                    const outcome = placeSignal({ ...signal, instanceId: instance.id, status: 'approved', auto: true });
                    if (outcome.ok) {
                        toast.success(`${strategy.name}: ${signal.side} ${outcome.qty} ${signal.symbol}`, { description: signal.reason });
                    } else {
                        toast.error(`${strategy.name} order refused`, { description: outcome.reason });
                    }
                } else {
                    toast.message(`${strategy.name} signal`, {
                        description: `${signal.side.toUpperCase()} ${signal.symbol} — ${signal.reason}`,
                    });
                }
            }
        };

        const timer = setInterval(tick, CYCLE_MS);
        tick();

        return () => {
            active = false;
            clearInterval(timer);
        };
    }, []);

    return null;
}
