'use client';

// Auto-trading runner. When mode !== 'manual' and the kill-switch is off, it
// periodically asks the signals agent for ideas and executes accepted ones under
// the configured guardrails. auto-paper → paper engine; auto-live → broker route
// (requires an armed live connection, else degrades to paper with a warning).

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useMarketStore } from '@/stores/marketStore';
import { usePaperStore } from '@/stores/paperStore';
import { useAgentStore } from '@/stores/agentStore';
import { useConnectionsStore } from '@/stores/connectionsStore';
import { fxRate } from '@/lib/paperEngine';
import { WATCHLIST_ASSETS } from '@/lib/mockData';
import type { TradeSignal } from '@/lib/ai/types';

const CYCLE_MS = 60000;

async function notify(text: string) {
    try {
        await fetch('/api/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'auto-trade', text }) });
    } catch {
        /* best effort */
    }
}

export function AgentEngine() {
    useEffect(() => {
        const timer = setInterval(async () => {
            const a = useAgentStore.getState();
            if (a.mode === 'manual' || a.killSwitch) return;
            if (!a.enabled.signals) return;

            const quotes = useMarketStore.getState().quotes;
            const paper = usePaperStore.getState();

            // daily-loss guardrail
            const startOfDay = new Date().setHours(0, 0, 0, 0);
            const lossToday = paper.state.fills.filter((f) => f.ts >= startOfDay).reduce((s, f) => s + Math.min(0, f.pnl), 0);
            if (-lossToday >= a.guardrails.maxDailyLossINR) return;
            if (Object.keys(paper.state.positions).length >= a.guardrails.maxOpenPositions) return;

            const market = WATCHLIST_ASSETS.map((asset) => {
                const q = quotes[asset.symbol];
                return { symbol: asset.symbol, price: q?.price ?? asset.price, changePercent: q?.changePercent ?? asset.changePercent };
            });
            const positions = Object.values(paper.state.positions).map((p) => ({ symbol: p.symbol, qty: p.qty, avgPrice: p.avgPrice }));

            let signals: TradeSignal[] = [];
            try {
                const res = await fetch('/api/agents/signals', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ market, positions, provider: a.provider || undefined }),
                });
                const data = await res.json();
                signals = data.signals ?? [];
                useAgentStore.getState().setSignals(signals);
            } catch {
                return;
            }

            const liveConn = useConnectionsStore.getState().connections.find((c) => c.mode === 'live' && c.status === 'connected');

            for (const sig of signals) {
                if (sig.confidence < a.guardrails.minConfidence) continue;
                const key = `${sig.symbol}:${sig.side}:${Math.round(sig.entry)}`;
                if (useAgentStore.getState().autoActedIds.includes(key)) continue;

                const price = quotes[sig.symbol]?.price ?? sig.entry;
                const fx = fxRate(sig.symbol);
                const rawQty = a.guardrails.maxOrderValueINR / (price * fx);
                const qty = sig.symbol.includes('/') ? +rawQty.toFixed(4) : Math.max(1, Math.floor(rawQty));
                if (qty <= 0) continue;

                useAgentStore.getState().markActed(key);

                if (a.mode === 'auto-live' && a.liveArmed && liveConn) {
                    try {
                        const res = await fetch(`/api/brokers/${liveConn.brokerId}/order`, {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ symbol: sig.symbol, side: sig.side, type: 'market', qty }),
                        });
                        if (res.ok) {
                            toast.success(`Live: ${sig.side} ${qty} ${sig.symbol}`);
                            notify(`🤖 LIVE ${sig.side.toUpperCase()} ${qty} ${sig.symbol} — ${sig.rationale}`);
                            continue;
                        }
                        // fall through to paper on non-ok
                        toast.message('Live routing unavailable — using paper', { description: `${liveConn.label}: credentials/route not ready` });
                    } catch {
                        /* degrade to paper */
                    }
                }

                // paper execution (default + degrade path)
                paper.place({ symbol: sig.symbol, side: sig.side, type: 'market', qty });
                toast.success(`Auto-paper: ${sig.side} ${qty} ${sig.symbol}`, { description: `conf ${sig.confidence} · ${sig.rationale}` });
                notify(`🤖 PAPER ${sig.side.toUpperCase()} ${qty} ${sig.symbol} (conf ${sig.confidence}) — ${sig.rationale}`);
            }
        }, CYCLE_MS);

        return () => clearInterval(timer);
    }, []);

    return null;
}
