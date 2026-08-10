'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { registerInstruments, unregisterInstrument, isSeeded } from '@/lib/instruments';
import { WATCHLIST_ASSETS, type Asset } from '@/lib/mockData';

// Editable watchlists.
//
// Custom instruments MUST be re-registered before anything can price or trade them:
// paperEngine.validate() rejects a symbol getAsset() can't resolve, and marketOf()
// would otherwise default it to 'crypto'/USD and mis-price an NSE stock in a ₹ book.
// Registration therefore happens on rehydrate, on add, and on cloud hydrate.

export interface WatchList {
    id: string;
    name: string;
    symbols: string[];
}

interface WatchlistStore {
    lists: WatchList[];
    activeListId: string;
    customInstruments: Asset[];

    setActive: (id: string) => void;
    createList: (name: string) => void;
    renameList: (id: string, name: string) => void;
    deleteList: (id: string) => void;
    addSymbol: (listId: string, symbol: string) => void;
    removeSymbol: (listId: string, symbol: string) => void;
    moveSymbol: (listId: string, from: number, to: number) => void;
    addInstrument: (asset: Asset, listId?: string) => void;
    /** All symbols across every list — what MarketEngine should subscribe to. */
    allSymbols: () => string[];
}

const DEFAULT_LIST: WatchList = {
    id: 'default',
    name: 'My watchlist',
    symbols: WATCHLIST_ASSETS.map((a) => a.symbol),
};

export const useWatchlistStore = create<WatchlistStore>()(
    persist(
        (set, get) => ({
            lists: [DEFAULT_LIST],
            activeListId: DEFAULT_LIST.id,
            customInstruments: [],

            setActive: (activeListId) => set({ activeListId }),

            createList: (name) =>
                set((s) => {
                    const id = `wl-${Date.now().toString(36)}`;
                    return { lists: [...s.lists, { id, name, symbols: [] }], activeListId: id };
                }),

            renameList: (id, name) =>
                set((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, name } : l)) })),

            deleteList: (id) =>
                set((s) => {
                    // Never leave the user with zero lists.
                    if (s.lists.length <= 1) return s;
                    const lists = s.lists.filter((l) => l.id !== id);
                    return { lists, activeListId: s.activeListId === id ? lists[0].id : s.activeListId };
                }),

            addSymbol: (listId, symbol) =>
                set((s) => ({
                    lists: s.lists.map((l) =>
                        l.id === listId && !l.symbols.includes(symbol) ? { ...l, symbols: [...l.symbols, symbol] } : l
                    ),
                })),

            removeSymbol: (listId, symbol) =>
                set((s) => {
                    const lists = s.lists.map((l) =>
                        l.id === listId ? { ...l, symbols: l.symbols.filter((x) => x !== symbol) } : l
                    );
                    // Drop a custom instrument from the registry once nothing references it.
                    const stillUsed = lists.some((l) => l.symbols.includes(symbol));
                    if (!stillUsed && !isSeeded(symbol)) unregisterInstrument(symbol);
                    return {
                        lists,
                        customInstruments: stillUsed ? s.customInstruments : s.customInstruments.filter((a) => a.symbol !== symbol),
                    };
                }),

            moveSymbol: (listId, from, to) =>
                set((s) => ({
                    lists: s.lists.map((l) => {
                        if (l.id !== listId) return l;
                        const symbols = [...l.symbols];
                        const [moved] = symbols.splice(from, 1);
                        if (moved == null) return l;
                        symbols.splice(to, 0, moved);
                        return { ...l, symbols };
                    }),
                })),

            addInstrument: (asset, listId) =>
                set((s) => {
                    registerInstruments([asset]);
                    const target = listId ?? s.activeListId;
                    return {
                        customInstruments: s.customInstruments.some((a) => a.symbol === asset.symbol)
                            ? s.customInstruments
                            : [...s.customInstruments, asset],
                        lists: s.lists.map((l) =>
                            l.id === target && !l.symbols.includes(asset.symbol)
                                ? { ...l, symbols: [...l.symbols, asset.symbol] }
                                : l
                        ),
                    };
                }),

            allSymbols: () => [...new Set(get().lists.flatMap((l) => l.symbols))],
        }),
        {
            name: 'gth-watchlists',
            onRehydrateStorage: () => (store) => {
                // Before any quote or order can reference them.
                if (store?.customInstruments?.length) registerInstruments(store.customInstruments);
            },
        }
    )
);
