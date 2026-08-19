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
import { rsi as rsiSeries, latest, type OHLC } from '@/lib/indicators';

const BAR_MS = 60_000;          // 1-minute bars
const MAX_BARS = 1500;          // ~25h, enough for a rolling 24h window
const WINDOW_24H_MS = 24 * 60 * 60 * 1000;

export interface Bar {
    t: number;  // bar open time (ms, floored to BAR_MS)
    o: number;
    h: number;
    l: number;
    c: number;
    /**
     * Volume, when it is genuinely known.
     *
     * Only `seed()` populates this, from real historical candles. Live bars are built
     * from quote ticks, and the crypto feed reports CUMULATIVE 24-hour volume — the
     * difference between two readings is not the volume traded in that minute, because
     * the 24h window is rolling off at the same time. Deriving a per-bar figure from it
     * would be a fabricated number, so live bars leave this undefined and anything
     * volume-based (VWAP) correctly returns null for them.
     */
    v?: number;
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

/** Live bars in the shape lib/indicators expects, so strategies share one indicator set. */
export function ohlc(symbol: string): OHLC[] {
    return (useSeriesStore.getState().bars[symbol] ?? []).map((b) => ({
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v,
    }));
}

/**
 * Memoise a latest-value indicator on the last CLOSED bar, so it recomputes once per
 * bar rather than on every tick. Any live indicator should go through this — the
 * scanner and the alert engine evaluate on a 1-second cadence.
 */
const memo = new Map<string, { key: string; value: number | null }>();

export function latestIndicator(
    symbol: string,
    name: string,
    compute: (bars: Bar[]) => number | null
): number | null {
    const bars = useSeriesStore.getState().bars[symbol] ?? [];
    if (!bars.length) return null;
    const cacheKey = `${symbol}:${name}`;
    const key = `${bars.length}:${bars[bars.length - 1].t}`;
    const hit = memo.get(cacheKey);
    if (hit && hit.key === key) return hit.value;
    const value = compute(bars);
    memo.set(cacheKey, { key, value });
    return value;
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

/**
 * Wilder RSI over closed bars. Returns null while warming up — callers must treat
 * that as "unknown" and exclude the row, never as a neutral 50.
 *
 * Delegates to lib/indicators so there is exactly one RSI in the codebase; this used
 * to be a second, independently written copy.
 */
export function rsi(symbol: string, period = 14): number | null {
    return latestIndicator(symbol, `rsi:${period}`, (bars) => {
        if (bars.length < period + 1) return null;
        return latest(rsiSeries(bars.map((b) => b.c), period));
    });
}
