'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StrategySignal } from '@/lib/strategies/runtime';

// The approval queue.
//
// Every strategy signal lands here first, including the ones an auto instance places
// itself — so there is always a record of what fired, what was decided, and what
// actually happened to the order. A signal that was silently acted on and left no trace
// would make the strategies impossible to audit or learn from.

export type SignalStatus =
    /** Waiting for you. */
    | 'pending'
    /** You approved it, or an auto instance approved it for you. */
    | 'approved'
    /** You declined it. */
    | 'skipped'
    /** The order reached the paper engine and was accepted. */
    | 'placed'
    /** The order was refused — by the kill switch, a coach rule, or buying power. */
    | 'rejected'
    /** Left pending long enough that the price it referenced is no longer meaningful. */
    | 'expired';

export interface QueuedSignal extends StrategySignal {
    instanceId: string;
    status: SignalStatus;
    /** Quantity as sized at decision time. */
    qty?: number;
    /** Why the engine refused it, verbatim from the order chokepoint. */
    rejectReason?: string;
    decidedAt?: number;
    /** True when an auto instance decided without asking. */
    auto: boolean;
}

/** Signals older than this are stale: the price they referenced has moved on. */
export const SIGNAL_TTL_MS = 30 * 60_000;
const MAX_RETAINED = 200;

interface SignalStore {
    signals: QueuedSignal[];
    rev: number;

    push: (signal: QueuedSignal) => boolean;
    setStatus: (id: string, status: SignalStatus, extra?: { qty?: number; rejectReason?: string }) => void;
    expireStale: (now?: number) => void;
    clearDecided: () => void;
    pending: () => QueuedSignal[];
}

export const useSignalStore = create<SignalStore>()(
    persist(
        (set, get) => ({
            signals: [],
            rev: 0,

            /** Returns false when the signal was a duplicate and nothing was added. */
            push: (signal) => {
                if (get().signals.some((s) => s.id === signal.id)) return false;
                set((s) => ({
                    signals: [signal, ...s.signals].slice(0, MAX_RETAINED),
                    rev: s.rev + 1,
                }));
                return true;
            },

            setStatus: (id, status, extra) =>
                set((s) => ({
                    signals: s.signals.map((sig) =>
                        sig.id === id ? { ...sig, status, decidedAt: Date.now(), ...extra } : sig
                    ),
                    rev: s.rev + 1,
                })),

            expireStale: (now = Date.now()) =>
                set((s) => {
                    let changed = false;
                    const signals = s.signals.map((sig) => {
                        if (sig.status !== 'pending' || now - sig.createdAt < SIGNAL_TTL_MS) return sig;
                        changed = true;
                        return { ...sig, status: 'expired' as const, decidedAt: now };
                    });
                    return changed ? { signals, rev: s.rev + 1 } : s;
                }),

            clearDecided: () =>
                set((s) => ({ signals: s.signals.filter((sig) => sig.status === 'pending'), rev: s.rev + 1 })),

            pending: () => get().signals.filter((s) => s.status === 'pending'),
        }),
        { name: 'gth-signals' }
    )
);
