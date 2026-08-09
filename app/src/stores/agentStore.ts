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
            guardrails: { maxOrderValueINR: 100000, maxDailyLossINR: 25000, maxOpenPositions: 8, minConfidence: 60 },

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
        { name: 'gth-agents', partialize: (s) => ({ mode: s.mode, liveArmed: s.liveArmed, provider: s.provider, enabled: s.enabled, guardrails: s.guardrails }) }
    )
);
