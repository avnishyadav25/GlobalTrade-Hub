import type { Candle } from '@/lib/mockData';
import type { Market } from '@/lib/constants';
import type { Strategy, StrategyEvent } from '../types';
import { hourly, nseIntraday, series } from '@/test/candles';

// Test harness: build a runnable configuration for ANY strategy.
//
// The generic invariants (takes no trades on flat data, losses are reachable, no NaN)
// are only meaningful if the strategy can actually trade in the fixture it is given. A
// pairs strategy with no second series, or a session strategy on bars stamped outside
// market hours, silently does nothing — and "never traded" would then pass a
// "cannot lose" check that was supposed to catch exactly that.
//
// Test-only. Nothing in the app imports this.

export interface Harness {
    bars: Candle[];
    market: Market;
    barSeconds: number;
    others?: Record<string, Candle[]>;
    events?: StrategyEvent[];
    symbol: string;
}

/**
 * A peer series that tracks the primary with a slow, tradeable divergence.
 *
 * The divergence is scaled by the primary's OWN variation, so a flat primary produces a
 * flat peer. A multiplicative wobble would make the spread oscillate even against a dead
 * market, and a pairs strategy would then legitimately trade on a "flat" fixture —
 * defeating the invariant that says no information must produce no trades.
 */
function peerOf(closes: number[]): number[] {
    const mean = closes.reduce((a, b) => a + b, 0) / Math.max(1, closes.length);
    const dev = Math.sqrt(closes.reduce((a, c) => a + (c - mean) ** 2, 0) / Math.max(1, closes.length));
    return closes.map((c, i) => c + dev * Math.sin(i / 23) * 0.6);
}

/** Synthetic scheduled events, alternating beats and misses so both sides are exercised. */
function eventsFor(kind: StrategyEvent['kind'], bars: Candle[]): StrategyEvent[] {
    const out: StrategyEvent[] = [];
    for (let i = 30; i < bars.length; i += 40) {
        const beat = out.length % 2 === 0;
        out.push({
            time: bars[i].time,
            kind,
            estimate: 100,
            actual: beat ? 140 : 60,   // +/-40%, comfortably past any threshold
        });
    }
    return out;
}

export interface HarnessOptions {
    /**
     * Omit scheduled events. An event-driven strategy trades on the RELEASE, not on
     * price, so it would legitimately fire against a flat market — which is not what the
     * "no information means no trades" invariant is testing.
     */
    quiet?: boolean;
}

export function harnessFor(strategy: Strategy, closes: number[], opts: HarnessOptions = {}): Harness {
    const isSession = strategy.family === 'session';
    const market = (strategy.markets[0] ?? 'us') as Market;

    let bars: Candle[];
    let barSeconds: number;

    if (isSession && strategy.markets.includes('india')) {
        // Real NSE session stamps, so barOfSession and minutesToClose are defined.
        bars = nseIntraday(closes);
        barSeconds = 900;
    } else if (isSession) {
        // Hourly bars spanning whole UTC days, so the quiet-session window exists.
        bars = hourly(closes);
        barSeconds = 3600;
    } else {
        bars = series(closes);
        barSeconds = 86_400;
    }

    const others: Record<string, Candle[]> = {};
    for (const req of strategy.requires ?? []) {
        const peer = peerOf(closes);
        others[req.role] = isSession
            ? strategy.markets.includes('india') ? nseIntraday(peer) : hourly(peer)
            : series(peer);
    }

    const events = opts.quiet ? [] : (strategy.needsEvents ?? []).flatMap((kind) => eventsFor(kind, bars));

    return {
        bars,
        market,
        barSeconds,
        symbol: market === 'crypto' ? 'BTC/USDT' : market === 'india' ? 'RELIANCE' : 'AAPL',
        others: Object.keys(others).length ? others : undefined,
        events: events.length ? events : undefined,
    };
}
