'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    newPaperState,
    placeOrder as enginePlace,
    recordRejection as engineReject,
    cancelOrder as engineCancel,
    processTick,
    settleExpiries,
    deriveFxRates,
    migratePaperState,
    equity as engineEquity,
    type PaperState,
    type PlaceOrderInput,
    type PlaceResult,
    type FxRates,
    STARTING_CASH,
    PAPER_STATE_VERSION,
} from '@/lib/paperEngine';
import { useMarketStore, type LiveQuote } from './marketStore';
import { useAgentStore } from './agentStore';
import { useCoachStore } from './coachStore';
import { checkRules } from '@/lib/coach';

interface PaperStore {
    state: PaperState;
    equityHistory: number[]; // sampled equity for the session curve
    /** Set once when a persisted account had to be reset by a migration. */
    migrationNotice: string | null;
    place: (input: PlaceOrderInput) => PlaceResult;
    cancel: (orderId: string) => void;
    tick: (quotes: Record<string, LiveQuote>) => void;
    reset: () => void;
    sampleEquity: (value: number) => void;
    dismissMigrationNotice: () => void;
    /** Current currency->INR table, derived from live quotes. */
    fx: () => FxRates;
}

/** Live FX table from the market store, so every conversion uses the same rates. */
function currentFx(): FxRates {
    return deriveFxRates(useMarketStore.getState().quotes);
}

export const usePaperStore = create<PaperStore>()(
    persist(
        (set, get) => ({
            state: newPaperState(STARTING_CASH, Date.now()),
            equityHistory: [STARTING_CASH],
            migrationNotice: null,

            fx: currentFx,

            /**
             * The single chokepoint for placing a paper order.
             *
             * Kill-switch and coach-rule checks live HERE, not in the order ticket.
             * They used to sit in OrderTicket.submit only — after the live-mode early
             * return — so three paths bypassed them entirely: live mode, the Agents
             * screen's "Trade →" button, and the auto-trading loop. The UI claimed rules
             * were "enforced on your paper & live order tickets" while they were not.
             */
            place: (input) => {
                const market = useMarketStore.getState();

                // Rejections are RECORDED, not just toasted — otherwise the Orders
                // screen can never show why an order was refused.
                const reject = (reason: string) => {
                    const { state, result } = engineReject(get().state, input, reason, Date.now());
                    set({ state });
                    return result;
                };

                if (useAgentStore.getState().killSwitch) {
                    return reject('Kill-switch is on — all order placement is halted.');
                }

                const gate = checkRules(
                    useCoachStore.getState().appliedRules,
                    get().state,
                    { symbol: input.symbol, qty: input.qty, price: input.limitPrice ?? market.getQuote(input.symbol)?.price ?? 0 },
                    market.quotes
                );
                if (!gate.allowed) {
                    return reject(gate.reason ?? 'Blocked by an applied coach rule.');
                }

                const { state, result } = enginePlace(get().state, input, market.getQuote(input.symbol), currentFx(), Date.now());
                set({ state });
                return result;
            },

            cancel: (orderId) => set({ state: engineCancel(get().state, orderId, Date.now()) }),

            tick: (quotes) => {
                const before = get().state;
                const now = Date.now();
                const fx = deriveFxRates(quotes);

                // Settlement runs BEFORE matching, so a resting order on an expired
                // contract cannot fill after the contract has already settled.
                const { state: settled } = settleExpiries(before, quotes, fx, now);
                const after = processTick(settled, quotes, fx, now);
                if (after !== before) set({ state: after });
            },

            reset: () =>
                set({
                    state: newPaperState(STARTING_CASH, Date.now()),
                    equityHistory: [STARTING_CASH],
                    migrationNotice: null,
                }),

            sampleEquity: (value) =>
                set((s) => ({ equityHistory: [...s.equityHistory, value].slice(-160) })),

            dismissMigrationNotice: () => set({ migrationNotice: null }),
        }),
        {
            name: 'gth-paper',
            version: PAPER_STATE_VERSION,
            partialize: (s) => ({
                state: s.state,
                equityHistory: s.equityHistory,
                migrationNotice: s.migrationNotice,
            }),
            /**
             * Persisted accounts from before the currency rewrite cannot be carried
             * forward: their fills were priced with a blanket USD->INR rate applied to
             * every non-India instrument, so the book mixes conventions and can never
             * satisfy the reconciliation identity. Reset and say so.
             */
            migrate: (persisted: unknown) => {
                const p = (persisted ?? {}) as { state?: unknown; equityHistory?: number[] };
                const { state, reset } = migratePaperState(p.state);
                return {
                    state,
                    equityHistory: reset ? [state.account.startingCash] : (p.equityHistory ?? [STARTING_CASH]),
                    migrationNotice: reset
                        ? 'Your paper account was reset: earlier trades were recorded with an incorrect currency conversion and could not be carried forward.'
                        : null,
                };
            },
            onRehydrateStorage: () => (store) => {
                // Guard against a corrupt or partial blob reaching the UI as NaN.
                if (store && !Number.isFinite(store.state?.account?.cash)) {
                    store.reset();
                }
            },
        }
    )
);

/** Equity marked at the current quotes and FX. */
export function currentEquity(): number {
    const quotes = useMarketStore.getState().quotes;
    return engineEquity(usePaperStore.getState().state, quotes, deriveFxRates(quotes));
}
