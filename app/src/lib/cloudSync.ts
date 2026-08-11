'use client';

// Full cloud sync: hydrate the client stores from Supabase (gth_app_state) on load,
// then debounce-persist changes. No-op when Supabase isn't configured (localStorage
// remains the store of record via zustand/persist).
//
// Broker connections are deliberately NOT synced here: they live server-side in
// gth_broker_connections, keyed to verified credentials in Vault.
//
// Server JSON is UNTRUSTED here: a stale or malformed row would otherwise be written
// straight into a store and surface as NaN across the UI with no error boundary. Every
// entry therefore declares a `validate` guard, and a row that fails it is skipped.

import { usePaperStore } from '@/stores/paperStore';
import { useAgentStore } from '@/stores/agentStore';
import { useCoachStore } from '@/stores/coachStore';
import { useUIStore } from '@/stores/uiStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useAlertStore } from '@/stores/alertStore';
import { useLearnStore } from '@/stores/learnStore';
import { registerInstruments } from '@/lib/instruments';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isPaperState } from '@/lib/paperEngine';

type AnyStore = {
    getState: () => Record<string, unknown>;
    setState: (partial: Record<string, unknown>) => void;
    subscribe: (fn: () => void) => () => void;
};

interface Entry {
    key: string;
    store: AnyStore;
    snapshot: (s: Record<string, unknown>) => Record<string, unknown>;
    /** Reject anything that would corrupt the store. Runs before setState. */
    validate: (value: Record<string, unknown>) => boolean;
    /**
     * Guard against hydration overwriting NEWER local state.
     *
     * Writes are debounced by 1.5s, so navigating right after an order remounts the
     * app and re-hydrates from a server row that predates the trade — silently
     * discarding it. Return false to keep what is already local.
     */
    isNewer?: (server: Record<string, unknown>, local: Record<string, unknown>) => boolean;
    /** Merge applied instead of a blind setState, for safety-critical fields. */
    apply?: (server: Record<string, unknown>, local: Record<string, unknown>) => Record<string, unknown>;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const isArr = Array.isArray;

const ENTRIES: Entry[] = [
    {
        key: 'paper',
        store: usePaperStore as unknown as AnyStore,
        snapshot: (s) => ({ state: s.state, equityHistory: s.equityHistory }),
        // Only accept a paper blob at the current schema version with finite cash.
        // An older-shaped row must not overwrite freshly-migrated local state.
        validate: (v) =>
            isPaperState(v.state) &&
            (v.equityHistory === undefined ||
                (isArr(v.equityHistory) && v.equityHistory.every((n) => typeof n === 'number' && Number.isFinite(n)))),
        // `seq` is the engine's monotonic counter: it only ever increases as orders
        // and fills are recorded, so it is a reliable "which copy is newer" signal.
        isNewer: (server, local) => {
            const s = (server.state as { seq?: number } | undefined)?.seq ?? -1;
            const l = (local.state as { seq?: number } | undefined)?.seq ?? -1;
            return s > l;
        },
    },
    {
        key: 'agents',
        store: useAgentStore as unknown as AnyStore,
        // killSwitch syncs across devices; liveArmed deliberately does not persist.
        snapshot: (s) => ({
            mode: s.mode,
            provider: s.provider,
            enabled: s.enabled,
            guardrails: s.guardrails,
            killSwitch: s.killSwitch,
        }),
        validate: (v) =>
            (v.mode === undefined || ['manual', 'auto-paper', 'auto-live'].includes(v.mode as string)) &&
            (v.guardrails === undefined || isObj(v.guardrails)) &&
            (v.killSwitch === undefined || typeof v.killSwitch === 'boolean'),
        // Fail safe: a server row must never switch a locally-engaged kill-switch off.
        apply: (server, local) => ({
            ...server,
            killSwitch: Boolean(local.killSwitch) || Boolean(server.killSwitch),
        }),
    },
    {
        key: 'coach',
        store: useCoachStore as unknown as AnyStore,
        snapshot: (s) => ({ appliedRules: s.appliedRules }),
        validate: (v) => v.appliedRules === undefined || isArr(v.appliedRules),
    },
    {
        key: 'watchlists',
        store: useWatchlistStore as unknown as AnyStore,
        snapshot: (s) => ({ lists: s.lists, activeListId: s.activeListId, customInstruments: s.customInstruments }),
        validate: (v) => isArr(v.lists) && (v.customInstruments === undefined || isArr(v.customInstruments)),
        // Custom instruments must reach the registry before anything can price them.
        apply: (server, local) => {
            if (isArr(server.customInstruments)) registerInstruments(server.customInstruments as unknown[]);
            return { ...local, ...server };
        },
    },
    {
        key: 'alerts',
        store: useAlertStore as unknown as AnyStore,
        snapshot: (s) => ({ alerts: s.alerts }),
        validate: (v) => v.alerts === undefined || isArr(v.alerts),
    },
    {
        key: 'learn',
        store: useLearnStore as unknown as AnyStore,
        snapshot: (s) => ({
            completed: s.completed,
            observedSymbols: s.observedSymbols,
            observedMarkets: s.observedMarkets,
            seenCoachMarks: s.seenCoachMarks,
            skipped: s.skipped,
            quizAnswers: s.quizAnswers,
            guideEnabled: s.guideEnabled,
            rev: s.rev,
        }),
        validate: (v) => v.completed === undefined || isObj(v.completed),
        // Without this guard a stale server row overwrites newer local progress, so a
        // dismissed coach mark or a skipped lesson comes back after a remount. `rev`
        // increments on every learn mutation, exactly as `seq` does for paper.
        isNewer: (server, local) => {
            const s = typeof server.rev === 'number' ? server.rev : -1;
            const l = typeof local.rev === 'number' ? local.rev : -1;
            return s > l;
        },
    },
    {
        key: 'ui',
        store: useUIStore as unknown as AnyStore,
        snapshot: (s) => ({ selectedSymbol: s.selectedSymbol, timeframe: s.timeframe, tradeMode: s.tradeMode }),
        validate: (v) =>
            (v.selectedSymbol === undefined || typeof v.selectedSymbol === 'string') &&
            (v.tradeMode === undefined || ['paper', 'live'].includes(v.tradeMode as string)),
    },
];

export function startCloudSync(): () => void {
    if (!isSupabaseConfigured()) return () => {};

    let active = true;
    const unsubs: Array<() => void> = [];
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};

    (async () => {
        // Hydrate. Fetch concurrently — the old sequential loop meant the UI rendered
        // local defaults and then jumped, once per store.
        const results = await Promise.all(
            ENTRIES.map(async (e) => {
                try {
                    const res = await fetch(`/api/state/${e.key}`);
                    if (!res.ok) return { e, value: null, configured: res.status !== 401 };
                    const data = await res.json();
                    return { e, value: data.value, configured: data.configured !== false };
                } catch {
                    return { e, value: null, configured: true };
                }
            })
        );
        if (!active) return;

        // If the server has no state store at all, stay on localStorage entirely
        // rather than applying a partial hydration.
        if (results.every((r) => !r.configured)) return;

        for (const { e, value } of results) {
            if (!isObj(value)) continue;
            if (!e.validate(value)) {
                console.warn(`[cloudSync] ignoring malformed "${e.key}" row from the server`);
                continue;
            }
            const local = e.store.getState();
            if (e.isNewer && !e.isNewer(value, local)) {
                console.info(`[cloudSync] keeping newer local "${e.key}" state`);
                continue;
            }
            e.store.setState(e.apply ? e.apply(value, local) : value);
        }

        // persist on change (debounced)
        for (const e of ENTRIES) {
            const unsub = e.store.subscribe(() => {
                clearTimeout(timers[e.key]);
                timers[e.key] = setTimeout(() => {
                    delete timers[e.key];
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
        // Flush pending writes rather than dropping them. `keepalive` lets the request
        // outlive the navigation that triggered this cleanup, so a trade placed moments
        // before navigating still reaches the server.
        for (const [key, timer] of Object.entries(timers)) {
            clearTimeout(timer);
            const entry = ENTRIES.find((e) => e.key === key);
            if (!entry) continue;
            try {
                fetch(`/api/state/${key}`, {
                    method: 'PUT',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ value: entry.snapshot(entry.store.getState()) }),
                    keepalive: true,
                }).catch(() => {});
            } catch {
                /* best effort */
            }
        }
    };
}
