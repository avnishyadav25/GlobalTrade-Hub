'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    newPaperState,
    placeOrder as enginePlace,
    cancelOrder as engineCancel,
    processTick,
    type PaperState,
    type PlaceOrderInput,
    STARTING_CASH,
} from '@/lib/paperEngine';
import { useMarketStore, type LiveQuote } from './marketStore';

interface PaperStore {
    state: PaperState;
    equityHistory: number[]; // sampled equity for the session curve
    place: (input: PlaceOrderInput) => void;
    cancel: (orderId: string) => void;
    tick: (quotes: Record<string, LiveQuote>) => void;
    reset: () => void;
    sampleEquity: (value: number) => void;
}

export const usePaperStore = create<PaperStore>()(
    persist(
        (set, get) => ({
            state: newPaperState(),
            equityHistory: [STARTING_CASH],

            place: (input) => {
                const quote = useMarketStore.getState().getQuote(input.symbol);
                set({ state: enginePlace(get().state, input, quote) });
            },

            cancel: (orderId) => set({ state: engineCancel(get().state, orderId) }),

            tick: (quotes) => {
                const before = get().state;
                const after = processTick(before, quotes);
                if (after !== before) set({ state: after });
            },

            reset: () => set({ state: newPaperState(), equityHistory: [STARTING_CASH] }),

            sampleEquity: (value) =>
                set((s) => ({ equityHistory: [...s.equityHistory, value].slice(-160) })),
        }),
        {
            name: 'gth-paper',
            partialize: (s) => ({ state: s.state, equityHistory: s.equityHistory }),
        }
    )
);
