'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CoachReport } from '@/lib/coach';

interface CoachStore {
    appliedRules: Record<string, boolean>;
    report: CoachReport | null;
    toggleRule: (id: string) => void;
    setReport: (r: CoachReport) => void;
}

export const useCoachStore = create<CoachStore>()(
    persist(
        (set) => ({
            appliedRules: {},
            report: null,
            toggleRule: (id) =>
                set((s) => ({ appliedRules: { ...s.appliedRules, [id]: !s.appliedRules[id] } })),
            setReport: (r) => set({ report: r }),
        }),
        { name: 'gth-coach', partialize: (s) => ({ appliedRules: s.appliedRules }) }
    )
);
