'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Params } from '@/lib/strategies/types';
import type { EvaluationMemory } from '@/lib/strategies/runtime';

// Which strategies are running, on what, and how much freedom they have.
//
// A strategy is a definition; an INSTANCE is that definition pointed at one instrument
// on one timeframe with one set of parameters. The same strategy can run twice on
// different instruments, and each keeps its own edge-trigger memory.

export type RunMode = 'review' | 'auto';

export interface StrategyInstance {
    id: string;
    strategyId: string;
    symbol: string;
    timeframe: string;
    params: Params;
    enabled: boolean;
    /**
     * `review` posts to the approval queue; `auto` places the order itself.
     * Everything ships in review, and auto is opted into per instance, once you have
     * watched what it actually does.
     */
    mode: RunMode;
    createdAt: number;
}

interface StrategyStore {
    instances: StrategyInstance[];
    /** Edge-trigger memory, keyed by instance id. Lost memory means repeated signals. */
    memory: Record<string, EvaluationMemory>;
    /** Percentage of equity risked per signal, when the signal carries a stop. */
    riskPct: number;
    /** How many instances may be evaluated. Each one is a candle fetch. */
    maxActive: number;
    rev: number;

    add: (instance: Omit<StrategyInstance, 'id' | 'createdAt'>) => string;
    remove: (id: string) => void;
    setEnabled: (id: string, enabled: boolean) => void;
    setMode: (id: string, mode: RunMode) => void;
    setParams: (id: string, params: Params) => void;
    setMemory: (id: string, memory: EvaluationMemory) => void;
    setRiskPct: (pct: number) => void;
    activeInstances: () => StrategyInstance[];
}

export const useStrategyStore = create<StrategyStore>()(
    persist(
        (set, get) => ({
            instances: [],
            memory: {},
            riskPct: 1,
            maxActive: 8,
            rev: 0,

            add: (instance) => {
                const id = `si-${Date.now().toString(36)}-${Math.floor(performance.now() % 1000)}`;
                set((s) => ({ instances: [...s.instances, { ...instance, id, createdAt: Date.now() }], rev: s.rev + 1 }));
                return id;
            },

            remove: (id) =>
                set((s) => {
                    const memory = { ...s.memory };
                    delete memory[id];
                    return { instances: s.instances.filter((i) => i.id !== id), memory, rev: s.rev + 1 };
                }),

            setEnabled: (id, enabled) =>
                set((s) => {
                    // Clear the memory on enable. A strategy whose condition is already
                    // true must ARM silently rather than fire the moment you switch it on.
                    const memory = { ...s.memory };
                    if (enabled) delete memory[id];
                    return { instances: s.instances.map((i) => (i.id === id ? { ...i, enabled } : i)), memory, rev: s.rev + 1 };
                }),

            setMode: (id, mode) =>
                set((s) => ({ instances: s.instances.map((i) => (i.id === id ? { ...i, mode } : i)), rev: s.rev + 1 })),

            setParams: (id, params) =>
                set((s) => {
                    // Changing parameters changes the strategy, so its history is void.
                    const memory = { ...s.memory };
                    delete memory[id];
                    return { instances: s.instances.map((i) => (i.id === id ? { ...i, params } : i)), memory, rev: s.rev + 1 };
                }),

            setMemory: (id, m) => set((s) => ({ memory: { ...s.memory, [id]: m } })),

            setRiskPct: (pct) =>
                set((s) => ({ riskPct: Number.isFinite(pct) ? Math.min(10, Math.max(0.1, pct)) : s.riskPct, rev: s.rev + 1 })),

            activeInstances: () => get().instances.filter((i) => i.enabled).slice(0, get().maxActive),
        }),
        {
            name: 'gth-strategies',
            partialize: (s) => ({
                instances: s.instances,
                riskPct: s.riskPct,
                maxActive: s.maxActive,
                rev: s.rev,
                // `memory` is deliberately NOT persisted: after a reload the app has no
                // idea what it last reported, and re-arming silently is safer than
                // replaying a stale decision as if it were new.
            }),
        }
    )
);
