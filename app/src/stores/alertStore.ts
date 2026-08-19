'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Alert } from '@/lib/alerts';

interface AlertStore {
    alerts: Alert[];
    add: (a: Omit<Alert, 'id' | 'createdAt' | 'triggerCount'>) => void;
    update: (id: string, patch: Partial<Alert>) => void;
    remove: (id: string) => void;
    toggle: (id: string) => void;
    /** Store the latest readings so evaluation stays edge-triggered. */
    recordReadings: (readings: Record<string, number>) => void;
    markTriggered: (id: string, at: number) => void;
}

export const useAlertStore = create<AlertStore>()(
    persist(
        (set) => ({
            alerts: [],

            add: (a) =>
                set((s) => ({
                    alerts: [
                        ...s.alerts,
                        { ...a, id: `al-${Date.now().toString(36)}-${s.alerts.length}`, createdAt: Date.now(), triggerCount: 0 },
                    ],
                })),

            update: (id, patch) => set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
            remove: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
            toggle: (id) => set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)) })),

            recordReadings: (readings) =>
                set((s) => ({
                    alerts: s.alerts.map((a) => (readings[a.id] != null ? { ...a, lastValue: readings[a.id] } : a)),
                })),

            markTriggered: (id, at) =>
                set((s) => ({
                    alerts: s.alerts.map((a) =>
                        a.id === id
                            ? { ...a, lastTriggeredAt: at, triggerCount: a.triggerCount + 1, enabled: a.repeat ? a.enabled : false }
                            : a
                    ),
                })),
        }),
        { name: 'gth-alerts' }
    )
);
