'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIStore {
    selectedSymbol: string;
    timeframe: string;
    tradeMode: 'paper' | 'live';
    setSymbol: (s: string) => void;
    setTimeframe: (t: string) => void;
    setTradeMode: (m: 'paper' | 'live') => void;
}

export const useUIStore = create<UIStore>()(
    persist(
        (set) => ({
            selectedSymbol: 'BTC/USDT',
            timeframe: '15m',
            tradeMode: 'paper',
            setSymbol: (s) => set({ selectedSymbol: s }),
            setTimeframe: (t) => set({ timeframe: t }),
            setTradeMode: (m) => set({ tradeMode: m }),
        }),
        { name: 'gth-ui' }
    )
);
