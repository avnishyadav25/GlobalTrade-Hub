'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LearnStore {
    completed: Record<string, number>;
    /** Instruments and markets the user has actually opened — feeds lesson 1 and 2. */
    observedSymbols: string[];
    observedMarkets: string[];
    seenCoachMarks: Record<string, number>;
    observe: (symbol: string, market: string) => void;
    complete: (slug: string) => void;
    markCoachSeen: (topic: string) => void;
}

export const useLearnStore = create<LearnStore>()(
    persist(
        (set) => ({
            completed: {},
            observedSymbols: [],
            observedMarkets: [],
            seenCoachMarks: {},

            observe: (symbol, market) =>
                set((s) =>
                    s.observedSymbols.includes(symbol)
                        ? s
                        : {
                              observedSymbols: [...s.observedSymbols, symbol].slice(-50),
                              observedMarkets: s.observedMarkets.includes(market) ? s.observedMarkets : [...s.observedMarkets, market],
                          }
                ),

            complete: (slug) => set((s) => (s.completed[slug] ? s : { completed: { ...s.completed, [slug]: Date.now() } })),
            markCoachSeen: (topic) => set((s) => ({ seenCoachMarks: { ...s.seenCoachMarks, [topic]: Date.now() } })),
        }),
        { name: 'gth-learn' }
    )
);
