'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TradeSignal } from '@/lib/ai/types';

export type TradeMode = 'manual' | 'auto-paper' | 'auto-live';

export interface Guardrails {
    maxOrderValueINR: number;
    maxDailyLossINR: number;
    maxOpenPositions: number;
    minConfidence: number;
    /** Cap on how much of equity one instrument may represent. 0 disables it. */
    maxPerSymbolPct: number;
    /** Cap on orders placed per day. 0 disables it. */
    maxOrdersPerDay: number;
    /** Refuse new positions within this many minutes of the session close. 0 disables it. */
    squareOffBufferMin: number;
    /** Refuse orders entirely while the instrument's market is shut. */
    tradeOnlyWhenOpen: boolean;
}

interface AgentStore {
    mode: TradeMode;
    liveArmed: boolean;      // extra explicit gate for real-money auto-live
    killSwitch: boolean;     // hard stop for all auto actions
    provider: string;        // preferred LLM provider ('' = env default)
    enabled: Record<string, boolean>;
    guardrails: Guardrails;

    lastSignals: TradeSignal[];
    lastBriefing: string;
    lastRunAt: number;
    autoActedIds: string[];  // signal keys already executed (dedupe)

    setMode: (m: TradeMode) => void;
    setLiveArmed: (v: boolean) => void;
    setKillSwitch: (v: boolean) => void;
    setProvider: (p: string) => void;
    toggleAgent: (id: string) => void;
    setGuardrails: (g: Partial<Guardrails>) => void;
    setSignals: (s: TradeSignal[]) => void;
    setBriefing: (t: string) => void;
    markActed: (key: string) => void;
}

export const useAgentStore = create<AgentStore>()(
    persist(
        (set) => ({
            mode: 'manual',
            liveArmed: false,
            killSwitch: false,
            provider: '',
            enabled: { signals: true, journal: true, briefing: true, scanner: true },
            guardrails: {
                maxOrderValueINR: 100000,
                maxDailyLossINR: 25000,
                maxOpenPositions: 8,
                minConfidence: 60,
                // The newer limits default to OFF, so upgrading does not silently start
                // refusing orders that were previously allowed. Opt into each one.
                maxPerSymbolPct: 0,
                maxOrdersPerDay: 0,
                squareOffBufferMin: 0,
                tradeOnlyWhenOpen: false,
            },

            lastSignals: [],
            lastBriefing: '',
            lastRunAt: 0,
            autoActedIds: [],

            setMode: (mode) => set({ mode }),
            setLiveArmed: (liveArmed) => set({ liveArmed }),
            setKillSwitch: (killSwitch) => set({ killSwitch }),
            setProvider: (provider) => set({ provider }),
            toggleAgent: (id) => set((s) => ({ enabled: { ...s.enabled, [id]: !s.enabled[id] } })),
            setGuardrails: (g) => set((s) => ({ guardrails: { ...s.guardrails, ...g } })),
            setSignals: (lastSignals) => set({ lastSignals, lastRunAt: Date.now() }),
            setBriefing: (lastBriefing) => set({ lastBriefing }),
            markActed: (key) => set((s) => ({ autoActedIds: [...s.autoActedIds.slice(-200), key] })),
        }),
        {
            name: 'gth-agents',
            /**
             * `killSwitch` and `autoActedIds` MUST persist. Previously they did not while
             * `mode` and `liveArmed` did, so hitting the kill-switch and closing the tab
             * came back as `auto-live` + armed + kill-switch off — auto-trading resumed
             * with no interaction, and the dedupe set had emptied so old signals re-fired.
             *
             * `liveArmed` deliberately does NOT persist: arming real-money trading should
             * be a per-session decision, not something a stale tab restores.
             */
            partialize: (s) => ({
                mode: s.mode,
                provider: s.provider,
                enabled: s.enabled,
                guardrails: s.guardrails,
                killSwitch: s.killSwitch,
                autoActedIds: s.autoActedIds,
            }),
            merge: (persisted, current) => {
                const p = (persisted ?? {}) as Partial<AgentStore>;
                return {
                    ...current,
                    ...p,
                    // Fail safe: never restore an armed live state.
                    liveArmed: false,
                    // Never auto-clear a kill-switch that was left on.
                    killSwitch: p.killSwitch ?? current.killSwitch,
                };
            },
        }
    )
);
