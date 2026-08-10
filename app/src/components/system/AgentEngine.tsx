'use client';

// Auto-trading runner. When mode !== 'manual' and the kill-switch is off, it
// periodically asks the signals agent for ideas and executes accepted ones under
// the configured guardrails (shared with the manual "Trade →" path via
// lib/agentGuardrails, so both enforce exactly the same rules).
//
// auto-live routes to the broker API. If that route fails it SKIPS the signal and
// says so — it does not silently place a paper order instead, which would be a
// surprising substitution of a simulated trade for a real one.

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useMarketStore } from '@/stores/marketStore';
import { usePaperStore } from '@/stores/paperStore';
import { useAgentStore } from '@/stores/agentStore';
import { deriveFxRates } from '@/lib/paperEngine';
import { checkGuardrails, sizeFromGuardrails, signalKey, priceForSignal } from '@/lib/agentGuardrails';
import { WATCHLIST_ASSETS } from '@/lib/mockData';
import type { TradeSignal } from '@/lib/ai/types';

const CYCLE_MS = 60000;

async function notify(text: string) {
    try {
        await fetch('/api/notify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            // The route reads `text` and `subject`; `event` was silently dropped.
            body: JSON.stringify({ text, subject: 'GlobalTrade Hub — auto-trade' }),
        });
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
                if (!res.ok) return;
                const data = await res.json();
                signals = Array.isArray(data.signals) ? data.signals : [];
                useAgentStore.getState().setSignals(signals);
            } catch {
                return;
            }

            // The server is the source of truth for what is actually connected — the
            // old local store recorded a "connected" flag for credentials that had
            // never been verified or stored.
            let liveConn: { broker_id: string; label: string } | null = null;
            if (a.mode === 'auto-live') {
                try {
                    const res = await fetch('/api/brokers/connect');
                    const data = await res.json();
                    liveConn = (data.connections ?? []).find(
                        (c: { mode: string; status: string }) => c.mode === 'live' && c.status === 'connected'
                    ) ?? null;
                } catch {
                    liveConn = null;
                }
            }

            for (const sig of signals) {
                // Re-read state each iteration: an order placed earlier in this loop
                // changes the position count and the daily-loss total.
                const agent = useAgentStore.getState();
                if (agent.killSwitch) break;

                const book = usePaperStore.getState().state;
                const verdict = checkGuardrails({
                    guardrails: agent.guardrails,
                    book,
                    sig,
                    actedIds: agent.autoActedIds,
                    killSwitch: agent.killSwitch,
                });
                if (!verdict.allowed) continue;

                // Quotes are re-read here rather than reused from before the await —
                // by the time signals return, the captured snapshot is seconds stale.
                const freshQuotes = useMarketStore.getState().quotes;
                const fx = deriveFxRates(freshQuotes);
                const price = priceForSignal(sig, freshQuotes);
                const qty = sizeFromGuardrails(sig.symbol, price, agent.guardrails, fx);
                if (qty <= 0) continue;

                useAgentStore.getState().markActed(signalKey(sig));

                if (agent.mode === 'auto-live') {
                    if (!agent.liveArmed || !liveConn) {
                        toast.message('Auto-live not armed', { description: 'Arm live trading and connect a live broker to route real orders.' });
                        continue;
                    }
                    try {
                        const res = await fetch(`/api/brokers/${liveConn.broker_id}/order`, {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ symbol: sig.symbol, side: sig.side, type: 'market', qty, mode: 'live' }),
                        });
                        if (res.ok) {
                            toast.success(`Live: ${sig.side} ${qty} ${sig.symbol}`);
                            notify(`🤖 LIVE ${sig.side.toUpperCase()} ${qty} ${sig.symbol} — ${sig.rationale}`);
                        } else {
                            const detail = await res.json().catch(() => ({}));
                            toast.error('Live order failed — signal skipped', { description: detail.message ?? `${liveConn.label}: routing unavailable` });
                            notify(`⚠️ LIVE order FAILED for ${sig.symbol}: ${detail.message ?? 'routing unavailable'}. No paper substitute was placed.`);
                        }
                    } catch {
                        toast.error('Live order failed — signal skipped');
                    }
                    continue; // never substitute paper for a failed live order
                }

                // auto-paper
                const result = usePaperStore.getState().place({ symbol: sig.symbol, side: sig.side, type: 'market', qty });
                if (result.status === 'rejected') {
                    toast.error(`Auto-paper rejected ${sig.symbol}`, { description: result.reason });
                    continue;
                }
                toast.success(`Auto-paper: ${sig.side} ${qty} ${sig.symbol}`, { description: `conf ${sig.confidence} · ${sig.rationale}` });
                notify(`🤖 PAPER ${sig.side.toUpperCase()} ${qty} ${sig.symbol} (conf ${sig.confidence}) — ${sig.rationale}`);
            }
        }, CYCLE_MS);

        return () => clearInterval(timer);
    }, []);

    return null;
}
