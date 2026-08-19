import type { Candle } from '@/lib/mockData';
import type { Market } from '@/lib/constants';
import * as I from '@/lib/indicators';
import { sessionInfo, sessionStartIndices, barsSinceOpen } from '@/lib/sessions';
import type {
    Indicators, Params, PositionView, SeriesView, StrategyContext, StrategyEvent,
} from './types';

// Builds the object a strategy sees on each bar.
//
// WHY INDICATORS ARE COMPUTED OVER THE FULL SERIES
// Every indicator in lib/indicators is CAUSAL: the value at index j depends only on
// bars 0..j. So computing the whole series once and reading index `i` is identical to
// recomputing over `bars.slice(0, i+1)` on every bar — same numbers, without the O(n²).
// The lookahead guarantee comes from the ACCESSOR (`back` counts backwards and clamps
// at the cursor), not from truncating the input.

class Cursor {
    i = 0;
}

class IndicatorCache implements Indicators {
    private cache = new Map<string, unknown>();

    constructor(
        private readonly bars: Candle[],
        private readonly cursor: Cursor,
        private readonly others: Map<string, Candle[]>,
        private readonly vwapResets: number[]
    ) {}

    private series<T>(key: string, build: () => (T | null)[]): (T | null)[] {
        const hit = this.cache.get(key);
        if (hit) return hit as (T | null)[];
        const built = build();
        this.cache.set(key, built);
        return built;
    }

    /** Read `back` bars before the cursor. Negative or future offsets are refused. */
    private at<T>(series: (T | null)[], back: number | undefined): T | null {
        const steps = Math.max(0, Math.floor(back ?? 0));
        const idx = this.cursor.i - steps;
        if (idx < 0 || idx >= series.length) return null;
        return series[idx] ?? null;
    }

    private _closes: number[] | null = null;
    private closes(): number[] {
        if (!this._closes) this._closes = this.bars.map((b) => b.close);
        return this._closes;
    }

    sma(period: number, back?: number) {
        return this.at(this.series(`sma:${period}`, () => I.sma(this.closes(), period)), back);
    }
    ema(period: number, back?: number) {
        return this.at(this.series(`ema:${period}`, () => I.ema(this.closes(), period)), back);
    }
    wma(period: number, back?: number) {
        return this.at(this.series(`wma:${period}`, () => I.wma(this.closes(), period)), back);
    }
    rsi(period: number, back?: number) {
        return this.at(this.series(`rsi:${period}`, () => I.rsi(this.closes(), period)), back);
    }
    stddev(period: number, back?: number) {
        return this.at(this.series(`sd:${period}`, () => I.stddev(this.closes(), period)), back);
    }
    zscore(period: number, back?: number) {
        return this.at(this.series(`z:${period}`, () => I.zscore(this.closes(), period)), back);
    }
    roc(period: number, back?: number) {
        return this.at(this.series(`roc:${period}`, () => I.roc(this.closes(), period)), back);
    }
    atr(period: number, back?: number) {
        return this.at(this.series(`atr:${period}`, () => I.atr(this.bars, period)), back);
    }
    bollinger(period: number, mult: number, back?: number) {
        return this.at(this.series(`bb:${period}:${mult}`, () => I.bollinger(this.closes(), period, mult)), back);
    }
    macd(fast: number, slow: number, signal: number, back?: number) {
        return this.at(this.series(`macd:${fast}:${slow}:${signal}`, () => I.macd(this.closes(), fast, slow, signal)), back);
    }
    donchian(period: number, back?: number) {
        return this.at(this.series(`dc:${period}`, () => I.donchian(this.bars, period)), back);
    }
    stochastic(kPeriod: number, dPeriod: number, back?: number) {
        return this.at(this.series(`st:${kPeriod}:${dPeriod}`, () => I.stochastic(this.bars, kPeriod, dPeriod)), back);
    }
    vwap(back?: number) {
        return this.at(this.series('vwap', () => I.vwap(this.bars, this.vwapResets)), back);
    }
    highest(period: number, back?: number) {
        return this.at(this.series(`hh:${period}`, () => I.rollingMax(this.bars.map((b) => b.high), period)), back);
    }
    lowest(period: number, back?: number) {
        return this.at(this.series(`ll:${period}`, () => I.rollingMin(this.bars.map((b) => b.low), period)), back);
    }
    correlationWith(role: string, period: number, back?: number) {
        const other = this.others.get(role);
        if (!other) return null;
        return this.at(
            this.series(`corr:${role}:${period}`, () =>
                I.correlation(this.closes(), other.map((b) => b.close), period)
            ),
            back
        );
    }
}

function seriesView(bars: Candle[], cursor: Cursor): SeriesView {
    return {
        get length() {
            return Math.min(cursor.i + 1, bars.length);
        },
        bar(back = 0) {
            const idx = cursor.i - Math.max(0, Math.floor(back));
            return idx >= 0 && idx < bars.length ? bars[idx] : undefined;
        },
        close(back = 0) {
            const idx = cursor.i - Math.max(0, Math.floor(back));
            return idx >= 0 && idx < bars.length ? bars[idx].close : undefined;
        },
    };
}

export interface ContextOptions {
    bars: Candle[];
    market: Market;
    barSeconds: number;
    params: Params;
    /** Additional instruments, keyed by the role the strategy declared. */
    others?: Record<string, Candle[]>;
    /** Sorted ascending by time. Filtered to "at or before now" on every bar. */
    events?: StrategyEvent[];
}

export interface ContextHandle {
    ctx: StrategyContext;
    /** Advance to bar `i` and refresh everything derived from it. */
    seek(i: number, position: PositionView | null, equity: number): StrategyContext;
}

/**
 * Create a reusable context. `seek` mutates the cursor rather than rebuilding, so the
 * indicator cache survives the whole run — one pass per indicator, not one per bar.
 */
export function createContext(opts: ContextOptions): ContextHandle {
    const { bars, market, barSeconds, params } = opts;
    const cursor = new Cursor();

    const others = new Map<string, Candle[]>(Object.entries(opts.others ?? {}));
    const otherViews = new Map<string, SeriesView>();
    for (const [role, series] of others) otherViews.set(role, seriesView(series, cursor));

    // Intraday VWAP resets at each session open; continuous markets anchor at the start.
    const vwapResets = sessionStartIndices(market, bars.map((b) => b.time));
    const ind = new IndicatorCache(bars, cursor, others, vwapResets);

    const events = [...(opts.events ?? [])].sort((a, b) => a.time - b.time);
    let eventCursor = 0;
    let visibleEvents: StrategyEvent[] = [];

    let position: PositionView | null = null;
    let equity = 0;

    const ctx: StrategyContext = {
        bar(back = 0) {
            const idx = cursor.i - Math.max(0, Math.floor(back));
            return idx >= 0 && idx < bars.length ? bars[idx] : undefined;
        },
        close(back = 0) {
            const idx = cursor.i - Math.max(0, Math.floor(back));
            return idx >= 0 && idx < bars.length ? bars[idx].close : undefined;
        },
        get length() {
            return Math.min(cursor.i + 1, bars.length);
        },
        get i() {
            return cursor.i;
        },
        get time() {
            return bars[cursor.i]?.time ?? 0;
        },
        ind,
        get position() {
            return position;
        },
        get equity() {
            return equity;
        },
        params,
        market,
        barSeconds,
        get session() {
            const t = bars[cursor.i]?.time;
            return t ? sessionInfo(market, t * 1000) : null;
        },
        get barOfSession() {
            const t = bars[cursor.i]?.time;
            return t ? barsSinceOpen(market, t * 1000, barSeconds) : null;
        },
        other(role) {
            return otherViews.get(role);
        },
        get events() {
            return visibleEvents;
        },
    };

    return {
        ctx,
        seek(i, pos, eq) {
            cursor.i = i;
            position = pos;
            equity = eq;

            // Events are revealed as the cursor passes them — never before. A strategy
            // that could see tomorrow's earnings surprise would be trivially profitable
            // and completely fictional.
            const now = bars[i]?.time ?? 0;
            while (eventCursor < events.length && events[eventCursor].time <= now) {
                visibleEvents = [...visibleEvents, events[eventCursor]];
                eventCursor++;
            }
            return ctx;
        },
    };
}
