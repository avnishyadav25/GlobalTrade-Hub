import type { Candle } from '@/lib/mockData';
import type { ChainView } from '@/lib/options/chainView';
import type { Market } from '@/lib/constants';
import type { PaperSide } from '@/lib/paperEngine';
import type { SessionInfo } from '@/lib/sessions';
import type { Band, Channel, Macd, Stochastic } from '@/lib/indicators';

// The strategy contract. One definition drives THREE things: the backtester, the live
// runtime, and the parameter form in the UI.
//
// Before this the strategy was inlined in the backtester's loop, so every new one would
// have been a fork of the engine, and every parameter would have needed a hand-written
// input and a hand-written clamp.
//
// THE LOOKAHEAD GUARANTEE
// A strategy never receives an indexable array of bars. It gets `bar(back)`, where
// `back` counts backwards from now — so `bars[i + 1]` is not expressible. This is the
// difference between "we were careful" and "it cannot happen": peeking at a future bar
// is the single most common way a backtest produces a beautiful, meaningless curve.

export type Family =
    | 'benchmark'
    | 'trend'
    | 'meanReversion'
    | 'breakout'
    | 'session'
    | 'spread'
    | 'volatility'
    | 'range'
    | 'event'
    | 'options';

export type ParamType = 'int' | 'float' | 'pct' | 'choice';

/** Drives the input control, the help text AND the clamping. One source of truth. */
export interface ParamSpec {
    key: string;
    label: string;
    /** Shown under the field. Explain what moving it actually does to the strategy. */
    help: string;
    type: ParamType;
    min?: number;
    max?: number;
    step?: number;
    choices?: { value: string; label: string }[];
    default: number | string;
}

export type Params = Record<string, number | string>;

export const num = (p: Params, key: string, fallback = 0): number => {
    const v = p[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
};
export const str = (p: Params, key: string, fallback = ''): string => {
    const v = p[key];
    return typeof v === 'string' ? v : fallback;
};

/* -------------------------------------------------------------------- sizing */

export type Sizing =
    /** A fixed percentage of current equity. Simple; ignores how far the stop is. */
    | { kind: 'equityPct'; pct: number }
    /**
     * Risk a fixed percentage of equity, sized from the distance to the stop.
     * This is the position-sizing lesson's formula: qty = (risk% × equity) / |entry − stop|.
     */
    | { kind: 'riskPct'; pct: number; stop: number }
    /** Risk a percentage of equity with the stop placed at `atrMult` × ATR. */
    | { kind: 'atrRisk'; pct: number; atrMult: number; atr: number };

/* ------------------------------------------------------------------- actions */

export interface EnterAction {
    kind: 'enter';
    side: PaperSide;
    sizing: Sizing;
    /** Protective stop price. Also used by `riskPct` sizing. */
    stop?: number;
    target?: number;
    reason: string;
}

export type Action =
    | { kind: 'hold' }
    | EnterAction
    | { kind: 'exit'; reason: string }
    /**
     * Move the protective stop on an open position — a trailing stop.
     *
     * The ENGINE enforces that this can only ever tighten toward profit. A stop that can
     * move away from price is not a stop; it is a mechanism for turning a small planned
     * loss into an unplanned large one, and it is not something each strategy should be
     * trusted to get right individually.
     */
    | { kind: 'setStop'; stop: number; target?: number; reason: string }
    /** A resting limit order, for grid and maker strategies. */
    | { kind: 'rest'; side: PaperSide; price: number; sizing: Sizing; reason: string };

export const HOLD: Action = { kind: 'hold' };

/* ------------------------------------------------------------------- context */

export interface PositionView {
    /** Signed: positive long, negative short. */
    qty: number;
    avgPrice: number;
    /** Bar index the position was opened on — for time-based exits. */
    entryIndex: number;
    stop?: number;
    target?: number;
}

/**
 * Indicator values AT A GIVEN BAR, counted backwards from now.
 *
 * `back` is always >= 0. Every series is computed once over the bars available up to
 * `i` and memoised, so a strategy that asks for `ema(20)` on every bar pays for it once.
 */
export interface Indicators {
    sma(period: number, back?: number): number | null;
    ema(period: number, back?: number): number | null;
    wma(period: number, back?: number): number | null;
    rsi(period: number, back?: number): number | null;
    atr(period: number, back?: number): number | null;
    stddev(period: number, back?: number): number | null;
    zscore(period: number, back?: number): number | null;
    roc(period: number, back?: number): number | null;
    bollinger(period: number, mult: number, back?: number): Band | null;
    macd(fast: number, slow: number, signal: number, back?: number): Macd | null;
    donchian(period: number, back?: number): Channel | null;
    stochastic(kPeriod: number, dPeriod: number, back?: number): Stochastic | null;
    vwap(back?: number): number | null;
    highest(period: number, back?: number): number | null;
    lowest(period: number, back?: number): number | null;
    /** Rolling correlation against another loaded series. */
    correlationWith(role: string, period: number, back?: number): number | null;
}

/** A second instrument, for pair, spread and cross-market strategies. */
export interface SeriesView {
    readonly length: number;
    bar(back?: number): Candle | undefined;
    close(back?: number): number | undefined;
}

/** Scheduled real-world events a strategy can react to (earnings, inventory reports). */
export interface StrategyEvent {
    /** Unix seconds. */
    time: number;
    kind: 'earnings' | 'inventory' | 'macro';
    symbol?: string;
    /** Reported value, when known. */
    actual?: number;
    /** Consensus estimate, when known. */
    estimate?: number;
    label?: string;
}

export interface StrategyContext {
    /** The bar `back` bars ago. `back = 0` is now. Undefined before the series starts. */
    bar(back?: number): Candle | undefined;
    /** Close price `back` bars ago — the common case, without the undefined dance. */
    close(back?: number): number | undefined;
    /** Bars available up to and including now. */
    readonly length: number;
    /** Index of the current bar in the full series. */
    readonly i: number;
    /** Current bar's open time, unix seconds. */
    readonly time: number;

    ind: Indicators;
    position: PositionView | null;
    equity: number;
    params: Params;
    market: Market;
    barSeconds: number;
    /** Null for continuous markets and when the session model has nothing to say. */
    session: SessionInfo | null;
    /** Which bar of the trading session this is; null when continuous or shut. */
    barOfSession: number | null;
    /** Additional instruments by role, e.g. 'hedge', 'product', 'vix'. */
    other(role: string): SeriesView | undefined;
    /** Events at or before now. Never future events — same lookahead guarantee. */
    events: readonly StrategyEvent[];

    /**
     * The option chain at this bar, when one is available.
     *
     * Undefined for every instrument that has no listed options, and for a run where no
     * chain source was supplied — so a strategy MUST handle its absence rather than
     * assuming it. The same no-lookahead guarantee applies: this view is built for this
     * bar and holds nothing from a later one.
     *
     * An equity strategy can read it as a filter (implied volatility as a regime signal,
     * say) without becoming an options strategy. Strategies that TRADE the chain use the
     * options runner, because a four-leg structure is one position with four strikes and
     * the single-instrument position model cannot hold that.
     */
    chain?: ChainView;
}

/* ------------------------------------------------------------------ strategy */

export interface Explain {
    /** One paragraph: what the strategy believes about the market. */
    idea: string;
    entry: string;
    exit: string;
    /**
     * The regime in which this makes money, and WHY the market pays for it.
     *
     * Optional so it can be filled in over time, but a strategy that ships with
     * `whenItFails` and no counterpart shows the reader only its downside — which is a
     * different distortion from the one `whenItFails` exists to prevent, not a safer
     * one. A test asserts the pair stays together.
     */
    whenItWorks?: string;
    /** The honest part: the regime in which this loses money. */
    whenItFails: string;
    /** Slug of the Learn lesson that covers the underlying concept. */
    lesson?: string;
}

export interface Strategy {
    id: string;
    name: string;
    family: Family;
    /** Markets this makes sense on. The UI hides it elsewhere. */
    markets: Market[];
    shape: 'single' | 'pair' | 'universe';
    /** Extra series this strategy needs loaded, by role. */
    requires?: { role: string; hint: string }[];
    /** Real-world events this strategy consumes. */
    needsEvents?: StrategyEvent['kind'][];
    params: ParamSpec[];
    /** Bars of history needed before `onBar` can produce a signal. */
    warmup(p: Params): number;
    onBar(ctx: StrategyContext): Action;
    /** Cross-field fixes that a per-field clamp cannot express, e.g. fast < slow. */
    normalise?(p: Params): Params;
    explain: Explain;
    /** Honest limits, rendered next to the strategy everywhere it appears. */
    caveats?: string[];
    /**
     * True when the strategy can be OBSERVED but not executed here — the funding-rate
     * carry needs a perpetual-futures instrument the paper engine does not have.
     * The UI must not offer a trade button for these.
     */
    signalOnly?: boolean;
}

/** Defaults straight from the specs, so there is no second copy to drift. */
export function defaultParams(strategy: Parameterised): Params {
    const out: Params = {};
    for (const spec of strategy.params) out[spec.key] = spec.default;
    return out;
}

/**
 * Clamp user input using the same specs that render the form.
 *
 * The old engine had a hand-written clamp ladder per field, which meant adding a
 * parameter required editing three places and forgetting one produced NaN equity.
 */
/**
 * The parts of a strategy that parameter handling actually needs.
 *
 * Structural rather than the full `Strategy`, so the options contract — a sibling shape
 * with legs instead of a single position — can share this without a cast, and without
 * pretending to be something it is not.
 */
export interface Parameterised {
    params: ParamSpec[];
    normalise?(p: Params): Params;
}

export function sanitiseParams(strategy: Parameterised, raw: Params = {}): Params {
    const out: Params = {};

    for (const spec of strategy.params) {
        const v = raw[spec.key];

        if (spec.type === 'choice') {
            const valid = typeof v === 'string' && spec.choices?.some((c) => c.value === v);
            out[spec.key] = valid ? v : spec.default;
            continue;
        }

        const n = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(n)) {
            out[spec.key] = spec.default;
            continue;
        }
        let clamped = Math.min(spec.max ?? Number.POSITIVE_INFINITY, Math.max(spec.min ?? Number.NEGATIVE_INFINITY, n));
        if (spec.type === 'int') clamped = Math.round(clamped);
        out[spec.key] = clamped;
    }

    return strategy.normalise ? strategy.normalise(out) : out;
}
