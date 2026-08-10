'use client';

// Rolling per-symbol price series built from live ticks.
//
// This exists because the scanner's RSI was derived from `generateCandleData`, which
// seeds its PRNG only from the symbol string — so the value never changed, and the
// "oversold"/"overbought" presets returned a fixed, immutable set of symbols forever.
// Breakouts compared the live price to a hardcoded `high24h`, so within minutes every
// instrument was permanently "breaking out".
//
// Deliberately NOT persisted: it is derived data that rebuilds from the feed, and
// writing ~1500 bars per symbol into localStorage/Supabase would be wasteful.

import { create } from 'zustand';

const BAR_MS = 60_000;          // 1-minute bars
const MAX_BARS = 1500;          // ~25h, enough for a rolling 24h window
const WINDOW_24H_MS = 24 * 60 * 60 * 1000;

export interface Bar {
    t: number;  // bar open time (ms, floored to BAR_MS)
    o: number;
    h: number;
    l: number;
    c: number;
}

interface SeriesState {
    bars: Record<string, Bar[]>;
    /** Real 24h high/low from the venue, when the feed supplies them (crypto). */
    feedRange: Record<string, { high: number; low: number }>;
    ingest: (symbol: string, price: number, ts?: number) => void;
    ingestRange: (symbol: string, high: number, low: number) => void;
    seed: (symbol: string, bars: Bar[]) => void;
    reset: () => void;
}

export const useSeriesStore = create<SeriesState>((set) => ({
    bars: {},
    feedRange: {},

    ingest: (symbol, price, ts = Date.now()) =>
        set((state) => {
            if (!Number.isFinite(price) || price <= 0) return state;
            const t = Math.floor(ts / BAR_MS) * BAR_MS;
            const existing = state.bars[symbol] ?? [];
            const last = existing[existing.length - 1];

            let next: Bar[];
            if (last && last.t === t) {
                // Mutating the last bar in place would defeat the memo keys downstream,
                // so replace it.
                const updated: Bar = { ...last, h: Math.max(last.h, price), l: Math.min(last.l, price), c: price };
                next = [...existing.slice(0, -1), updated];
            } else {
                next = [...existing, { t, o: price, h: price, l: price, c: price }];
                if (next.length > MAX_BARS) next = next.slice(next.length - MAX_BARS);
            }
            return { bars: { ...state.bars, [symbol]: next } };
        }),

    ingestRange: (symbol, high, low) =>
        set((state) => {
            if (!Number.isFinite(high) || !Number.isFinite(low)) return state;
            const cur = state.feedRange[symbol];
            if (cur && cur.high === high && cur.low === low) return state;
            return { feedRange: { ...state.feedRange, [symbol]: { high, low } } };
        }),

    seed: (symbol, bars) =>
        set((state) => ({ bars: { ...state.bars, [symbol]: bars.slice(-MAX_BARS) } })),

    reset: () => set({ bars: {}, feedRange: {} }),
}));

// ---- selectors (pure, memoised per closed bar) ----

export function closes(symbol: string): number[] {
    return (useSeriesStore.getState().bars[symbol] ?? []).map((b) => b.c);
}

export function barCount(symbol: string): number {
    return (useSeriesStore.getState().bars[symbol] ?? []).length;
}

/**
 * Rolling 24h high/low. Prefers the venue's own figures when the feed provides them
 * (Binance miniTicker carries true 24h h/l); otherwise computes from local bars and
 * reports how much history actually backs it.
 */
export function rolling24h(symbol: string, now = Date.now()): { high: number; low: number; coverageMs: number } | null {
    const state = useSeriesStore.getState();
    const feed = state.feedRange[symbol];
    if (feed) return { high: feed.high, low: feed.low, coverageMs: WINDOW_24H_MS };

    const bars = state.bars[symbol] ?? [];
    const cutoff = now - WINDOW_24H_MS;
    const win = bars.filter((b) => b.t >= cutoff);
    if (!win.length) return null;
    let high = -Infinity;
    let low = Infinity;
    for (const b of win) {
        if (b.h > high) high = b.h;
        if (b.l < low) low = b.l;
    }
    return { high, low, coverageMs: now - win[0].t };
}

const rsiCache = new Map<string, { key: string; value: number }>();

/**
 * Wilder RSI over closed bars. Returns null while warming up — callers must treat
 * that as "unknown" and exclude the row, never as a neutral 50.
 */
export function rsi(symbol: string, period = 14): number | null {
    const bars = useSeriesStore.getState().bars[symbol] ?? [];
    if (bars.length < period + 1) return null;

    // Memoise on the last bar's open time so this recomputes once per bar, not per tick.
    const key = `${bars.length}:${bars[bars.length - 1].t}:${period}`;
    const hit = rsiCache.get(symbol);
    if (hit && hit.key === key) return hit.value;

    const c = bars.map((b) => b.c);
    let gain = 0;
    let loss = 0;
    for (let i = 1; i <= period; i++) {
        const d = c[i] - c[i - 1];
        if (d >= 0) gain += d;
        else loss -= d;
    }
    gain /= period;
    loss /= period;
    for (let i = period + 1; i < c.length; i++) {
        const d = c[i] - c[i - 1];
        gain = (gain * (period - 1) + Math.max(0, d)) / period;
        loss = (loss * (period - 1) + Math.max(0, -d)) / period;
    }
    const value = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    rsiCache.set(symbol, { key, value });
    return value;
}
