import type { Candle } from '@/lib/mockData';

// Shared candle fixtures for strategy tests.
//
// Every strategy test needs the same handful of shapes — flat, trending, oscillating,
// gapping — and hand-rolling them per file produced subtly different bars that made
// failures hard to compare. Test-only: nothing in the app imports this.

export const DAY = 86_400;
export const T0 = 1_700_000_000;

export function bar(time: number, o: number, h: number, l: number, c: number, v = 1000): Candle {
    return { time, open: o, high: h, low: l, close: c, volume: v };
}

/** Bars from a close series, with the open equal to the previous close (no gaps). */
export function series(closes: number[], spread = 0.5, step = DAY, volume = 1000): Candle[] {
    return closes.map((c, i) => {
        const o = i === 0 ? c : closes[i - 1];
        return bar(T0 + i * step, o, Math.max(o, c) + spread, Math.min(o, c) - spread, c, volume);
    });
}

export const flat = (n: number, v = 100, spread = 0.5) => series(Array.from({ length: n }, () => v), spread);
export const rising = (n: number, step = 1, start = 100) =>
    series(Array.from({ length: n }, (_, i) => start + i * step));
export const falling = (n: number, step = 1, start = 400) =>
    series(Array.from({ length: n }, (_, i) => Math.max(1, start - i * step)));

/**
 * Rises for `up` bars then falls for `down` — the shape that traps trend-followers.
 * Clamped to a positive floor: an unclamped ramp runs the price negative, which is not
 * a market condition and makes every percentage metric meaningless.
 */
export const upThenDown = (up: number, down: number, step = 2, start = 100, floor = 5) =>
    series([
        ...Array.from({ length: up }, (_, i) => start + i * step),
        ...Array.from({ length: down }, (_, i) => Math.max(floor, start + up * step - (i + 1) * step)),
    ]);

/**
 * Falls then rises. Needed because a MONOTONIC series never produces a moving-average
 * crossover — the fast average sits above the slow one from the first bar and never
 * crosses it. A crossover strategy only signals where the trend actually changes.
 */
export const downThenUp = (down: number, up: number, step = 2, start = 300, floor = 5) =>
    series([
        ...Array.from({ length: down }, (_, i) => Math.max(floor, start - i * step)),
        ...Array.from({ length: up }, (_, i) => Math.max(floor, start - down * step) + (i + 1) * step),
    ]);

/** A clean sine wave — mean reversion works, trend following does not. */
export const oscillating = (n: number, amplitude = 12, period = 20, base = 100) =>
    series(Array.from({ length: n }, (_, i) => base + Math.sin((i / period) * Math.PI * 2) * amplitude));

/**
 * A falling market that still swings — the regime that destroys mean reversion.
 *
 * A LINEAR decline is useless for testing band strategies: price sits a constant
 * distance from its own lagging average, so a 2-standard-deviation band is never
 * breached and the strategy simply never trades. Real declines oscillate, every dip
 * looks like an overshoot, and each one is bought into a market that keeps going.
 */
export const decliningNoisy = (n: number, drift = -1.2, amplitude = 9, start = 400) =>
    series(Array.from({ length: n }, (_, i) => Math.max(5, start + i * drift + Math.sin(i / 5) * amplitude)));

/** Noisy but directionless: the regime where costs decide the outcome. */
export const choppy = (n: number, base = 100, amplitude = 3) =>
    series(Array.from({ length: n }, (_, i) => base + Math.sin(i / 1.7) * amplitude + Math.sin(i / 4.3) * amplitude * 0.6));

/** Hourly bars spanning whole UTC days — for FX session strategies. */
export function hourly(closes: number[], startUtc = Date.UTC(2026, 7, 10, 0, 0) / 1000): Candle[] {
    return closes.map((c, i) => {
        const o = i === 0 ? c : closes[i - 1];
        return bar(startUtc + i * 3600, o, Math.max(o, c) + 0.5, Math.min(o, c) - 0.5, c);
    });
}

/** NSE session bars built from an explicit close path, so adverse regimes can be intraday. */
export function nseIntraday(closes: number[], barsPerDay = 24, barSeconds = 900): Candle[] {
    const firstOpen = Date.UTC(2026, 7, 12, 3, 45) / 1000;   // 09:15 IST, a Wednesday
    return closes.map((c, i) => {
        const day = Math.floor(i / barsPerDay);
        const slot = i % barsPerDay;
        const o = i === 0 ? c : closes[i - 1];
        // Skip weekends so every generated bar lands in a real trading session.
        const calendarDay = day + Math.floor(day / 5) * 2;
        return bar(firstOpen + calendarDay * DAY + slot * barSeconds, o, Math.max(o, c) + 0.5, Math.min(o, c) - 0.5, c);
    });
}

/** Intraday bars stamped inside a real NSE session, for session-aware strategies. */
export function nseSession(dayCount: number, barsPerDay: number, closes: (d: number, b: number) => number, barSeconds = 900): Candle[] {
    const out: Candle[] = [];
    // 2026-08-12 is a Wednesday; 03:45 UTC is 09:15 IST, the opening bar.
    const firstOpen = Date.UTC(2026, 7, 12, 3, 45) / 1000;
    for (let d = 0; d < dayCount; d++) {
        const dayStart = firstOpen + d * DAY;
        for (let b = 0; b < barsPerDay; b++) {
            const c = closes(d, b);
            const prev = b === 0 && d === 0 ? c : out[out.length - 1].close;
            out.push(bar(dayStart + b * barSeconds, prev, Math.max(prev, c) + 0.5, Math.min(prev, c) - 0.5, c));
        }
    }
    return out;
}
