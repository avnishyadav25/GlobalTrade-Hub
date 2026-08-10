'use client';

// Live market-data store.
// Default source is a realistic random-walk simulation seeded from the instrument
// catalog. A real feed (e.g. Binance WS, Alpaca) can be attached via `attachFeed`,
// which pushes normalized quotes through `applyQuote` — the same path the sim uses.

import { create } from 'zustand';
import { WATCHLIST_ASSETS, type Asset } from '@/lib/mockData';
import { useSeriesStore } from './seriesStore';

export interface LiveQuote {
    symbol: string;
    price: number;
    prevClose: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
    volume: number;
    ts: number;
    dir: 'up' | 'down' | null;
}

type FeedDetach = () => void;
type FeedFactory = (
    symbols: string[],
    push: (q: Partial<LiveQuote> & { symbol: string }) => void,
    getQuote: (symbol: string) => LiveQuote | undefined,
    onStatus?: (connected: boolean) => void
) => FeedDetach;

export type FeedState = 'live' | 'delayed' | 'sim';

export interface MarketFeedStatus {
    state: FeedState;
    provider: string;
    delayMinutes: number;
    at: number;
}

interface MarketState {
    quotes: Record<string, LiveQuote>;
    running: boolean;
    usingRealFeed: boolean;
    /** Per-market provenance. One global flag was a lie in three directions. */
    feedStatus: Record<string, MarketFeedStatus>;
    setFeedStatus: (m: Record<string, MarketFeedStatus>) => void;
    _timer: ReturnType<typeof setInterval> | null;
    _detachFeed: FeedDetach | null;

    getQuote: (symbol: string) => LiveQuote | undefined;
    applyQuote: (q: Partial<LiveQuote> & { symbol: string }) => void;
    start: () => void;
    stop: () => void;
    attachFeed: (factory: FeedFactory) => void;
    detachFeed: () => void;
}

function seedQuote(a: Asset): LiveQuote {
    const prevClose = a.price - a.change;
    return {
        symbol: a.symbol,
        price: a.price,
        prevClose,
        change: a.change,
        changePercent: a.changePercent,
        high: a.high24h,
        low: a.low24h,
        volume: a.volume,
        ts: Date.now(),
        dir: null,
    };
}

const initialQuotes: Record<string, LiveQuote> = Object.fromEntries(
    WATCHLIST_ASSETS.map((a) => [a.symbol, seedQuote(a)])
);

export const useMarketStore = create<MarketState>((set, get) => ({
    quotes: initialQuotes,
    running: false,
    usingRealFeed: false,
    feedStatus: {},
    setFeedStatus: (feedStatus) => set((s) => ({ feedStatus: { ...s.feedStatus, ...feedStatus } })),
    _timer: null,
    _detachFeed: null,

    getQuote: (symbol) => get().quotes[symbol],

    applyQuote: (q) =>
        set((state) => {
            const prev = state.quotes[q.symbol];
            const price = q.price ?? prev?.price ?? 0;
            const prevClose = q.prevClose ?? prev?.prevClose ?? price;
            const change = price - prevClose;
            const next: LiveQuote = {
                symbol: q.symbol,
                price,
                prevClose,
                change,
                changePercent: prevClose ? (change / prevClose) * 100 : 0,
                high: Math.max(q.high ?? prev?.high ?? price, price),
                low: Math.min(q.low ?? prev?.low ?? price, price),
                volume: q.volume ?? prev?.volume ?? 0,
                ts: q.ts ?? Date.now(),
                dir: prev ? (price > prev.price ? 'up' : price < prev.price ? 'down' : prev.dir) : null,
            };
            // Feed the rolling series so indicators are computed from real observed
            // prices rather than a symbol-seeded generator.
            useSeriesStore.getState().ingest(q.symbol, price, next.ts);
            if (q.high != null && q.low != null) {
                useSeriesStore.getState().ingestRange(q.symbol, q.high, q.low);
            }
            return { quotes: { ...state.quotes, [q.symbol]: next } };
        }),

    start: () => {
        if (get().running || get().usingRealFeed) return;
        const timer = setInterval(() => {
            const { quotes, applyQuote } = get();
            for (const symbol of Object.keys(quotes)) {
                const cur = quotes[symbol];
                // volatility scaled to price magnitude, tighter for FX
                const isFx = symbol.includes('/') && (symbol.startsWith('EUR') || symbol.startsWith('GBP') || symbol.startsWith('USD'));
                const volPct = isFx ? 0.0004 : 0.0018;
                const drift = (Math.random() - 0.5) * 2 * volPct;
                const price = Math.max(0.0001, cur.price * (1 + drift));
                applyQuote({ symbol, price });
            }
        }, 1000);
        set({ running: true, _timer: timer });
    },

    stop: () => {
        const t = get()._timer;
        if (t) clearInterval(t);
        set({ running: false, _timer: null });
    },

    attachFeed: (factory) => {
        get().detachFeed();
        get().stop();
        const symbols = Object.keys(get().quotes);
        // `usingRealFeed` now tracks the socket's ACTUAL state, reported by the feed.
        // Setting it true on attach meant a failed connection still showed "LIVE".
        const detach = factory(
            symbols,
            (q) => get().applyQuote(q),
            (s) => get().quotes[s],
            (connected) => set({ usingRealFeed: connected })
        );
        set({ usingRealFeed: false, _detachFeed: detach });
    },

    detachFeed: () => {
        const d = get()._detachFeed;
        if (d) d();
        set({ usingRealFeed: false, _detachFeed: null });
    },
}));
