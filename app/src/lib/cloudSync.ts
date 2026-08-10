'use client';

// Full cloud sync: hydrate the client stores from Supabase (gth_app_state) on load,
// then debounce-persist changes. No-op when Supabase isn't configured (localStorage
// remains the store of record via zustand/persist).

import { usePaperStore } from '@/stores/paperStore';
import { useAgentStore } from '@/stores/agentStore';
import { useCoachStore } from '@/stores/coachStore';
import { useConnectionsStore } from '@/stores/connectionsStore';
import { useUIStore } from '@/stores/uiStore';
import { isSupabaseConfigured } from '@/lib/supabase/client';

type AnyStore = {
    getState: () => Record<string, unknown>;
    setState: (partial: Record<string, unknown>) => void;
    subscribe: (fn: () => void) => () => void;
};

interface Entry {
    key: string;
    store: AnyStore;
    snapshot: (s: Record<string, unknown>) => Record<string, unknown>;
}

const ENTRIES: Entry[] = [
    { key: 'paper', store: usePaperStore as unknown as AnyStore, snapshot: (s) => ({ state: s.state, equityHistory: s.equityHistory }) },
    { key: 'agents', store: useAgentStore as unknown as AnyStore, snapshot: (s) => ({ mode: s.mode, liveArmed: s.liveArmed, provider: s.provider, enabled: s.enabled, guardrails: s.guardrails }) },
    { key: 'coach', store: useCoachStore as unknown as AnyStore, snapshot: (s) => ({ appliedRules: s.appliedRules }) },
    { key: 'connections', store: useConnectionsStore as unknown as AnyStore, snapshot: (s) => ({ connections: s.connections }) },
    { key: 'ui', store: useUIStore as unknown as AnyStore, snapshot: (s) => ({ selectedSymbol: s.selectedSymbol, timeframe: s.timeframe, tradeMode: s.tradeMode }) },
];

export function startCloudSync(): () => void {
    if (!isSupabaseConfigured()) return () => {};

    let active = true;
    const unsubs: Array<() => void> = [];
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};

    (async () => {
        // hydrate
        for (const e of ENTRIES) {
            try {
                const res = await fetch(`/api/state/${e.key}`);
                const data = await res.json();
                if (data.configured === false) { active = false; return; }
                if (data.value && typeof data.value === 'object') e.store.setState(data.value);
            } catch {
                /* ignore; keep local */
            }
        }
        if (!active) return;

        // persist on change (debounced)
        for (const e of ENTRIES) {
            const unsub = e.store.subscribe(() => {
                clearTimeout(timers[e.key]);
                timers[e.key] = setTimeout(() => {
                    fetch(`/api/state/${e.key}`, {
                        method: 'PUT',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ value: e.snapshot(e.store.getState()) }),
                    }).catch(() => {});
                }, 1500);
            });
            unsubs.push(unsub);
        }
    })();

    return () => {
        active = false;
        unsubs.forEach((u) => u());
        Object.values(timers).forEach((t) => clearTimeout(t));
    };
}
