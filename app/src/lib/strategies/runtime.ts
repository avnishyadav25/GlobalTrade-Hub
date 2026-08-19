import type { Candle } from '@/lib/mockData';
import type { Market } from '@/lib/constants';
import type { PaperSide } from '@/lib/paperEngine';
import { createContext } from './context';
import { sanitiseParams, type Action, type Params, type PositionView, type Strategy, type StrategyEvent } from './types';

// Live strategy evaluation.
//
// Deliberately pure: this file decides WHAT a strategy wants to do; the component that
// calls it decides whether anything happens. That split is what makes the interesting
// behaviour — edge triggering, cooldowns, warm-up refusal — testable without a browser.
//
// THREE INVARIANTS, lifted verbatim from lib/alerts.ts, where they are already proven by
// thirteen tests:
//   1. EDGE-TRIGGERED. A signal fires when the decision CHANGES, not on every bar it
//      remains true. Enabling a strategy whose condition is already met arms it
//      silently rather than firing immediately.
//   2. UNKNOWN NEVER FIRES. A strategy that returns HOLD because an indicator is still
//      warming up produces nothing, and does not record a baseline either.
//   3. PER-ITEM COOLDOWN. One strategy-instrument pair cannot fire twice inside the
//      cooldown window, however often it is evaluated.

export interface StrategySignal {
    id: string;
    strategyId: string;
    strategyName: string;
    symbol: string;
    market: Market;
    timeframe: string;
    /** What the strategy wants. `exit` closes whatever is open. */
    intent: 'enter' | 'exit';
    side: PaperSide;
    /** Reference price at signal time — the close of the bar that triggered it. */
    price: number;
    stop?: number;
    target?: number;
    reason: string;
    params: Params;
    /** Open time of the bar that produced this, in unix seconds. */
    barTime: number;
    createdAt: number;
}

/** Per (strategy, symbol) memory that makes evaluation edge-triggered across ticks. */
export interface EvaluationMemory {
    /** The last decision, as a stable key. Undefined until the first evaluation. */
    lastKey?: string;
    /** When this pair last produced a signal. */
    lastFiredAt?: number;
    /** Open time of the last bar evaluated, so one bar cannot fire twice. */
    lastBarTime?: number;
}

export interface EvaluateInput {
    strategy: Strategy;
    params?: Params;
    symbol: string;
    market: Market;
    timeframe: string;
    barSeconds: number;
    bars: Candle[];
    /** The live position in this instrument, if any. */
    position: PositionView | null;
    equity: number;
    others?: Record<string, Candle[]>;
    events?: StrategyEvent[];
    memory: EvaluationMemory;
    now?: number;
    cooldownMs?: number;
}

export interface EvaluateResult {
    signal: StrategySignal | null;
    memory: EvaluationMemory;
    /** Why nothing fired, when nothing did. Surfaced in the UI so silence is legible. */
    skipped?: 'warming-up' | 'no-change' | 'cooldown' | 'same-bar' | 'holding' | 'not-enough-bars';
}

/** One firing per pair per this window, however often the engine ticks. */
export const DEFAULT_COOLDOWN_MS = 5 * 60_000;

function actionKey(action: Action, position: PositionView | null): string {
    const held = position ? (position.qty > 0 ? 'long' : 'short') : 'flat';
    switch (action.kind) {
        case 'enter':
            return `enter:${action.side}:${held}`;
        case 'exit':
            return `exit:${held}`;
        case 'rest':
            // The price is part of the identity: a grid moving its rung IS a new decision.
            return `rest:${action.side}:${action.price.toFixed(6)}`;
        case 'setStop':
            return `stop:${action.stop.toFixed(6)}`;
        default:
            return `hold:${held}`;
    }
}

/**
 * Evaluate one strategy against one instrument's latest bar.
 *
 * Returns the signal it wants to raise, plus the memory to carry into the next tick.
 * The caller must persist that memory, or every tick looks like a fresh start and the
 * edge-trigger guarantee is lost.
 */
export function evaluateStrategy(input: EvaluateInput): EvaluateResult {
    const { strategy, symbol, market, bars, position, memory } = input;
    const now = input.now ?? Date.now();
    const cooldownMs = input.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    const params = sanitiseParams(strategy, input.params ?? {});
    const warmup = Math.max(0, Math.floor(strategy.warmup(params)));

    if (bars.length < warmup + 2) {
        // Not enough history to have an opinion. Deliberately does NOT record a baseline:
        // arming on an unknown would make the first real reading look like a change.
        return { signal: null, memory, skipped: 'not-enough-bars' };
    }

    const last = bars[bars.length - 1];
    const handle = createContext({
        bars,
        market,
        barSeconds: input.barSeconds,
        params,
        others: input.others,
        events: input.events,
    });
    // Decide on the CLOSED bar, exactly as the backtester does. Acting on a bar that is
    // still forming means acting on a price that can still change.
    const ctx = handle.seek(bars.length - 1, position, input.equity);
    const action = strategy.onBar(ctx);

    if (action.kind === 'hold') {
        // Record the baseline so a later change is detectable, but fire nothing.
        return { signal: null, memory: { ...memory, lastKey: actionKey(action, position), lastBarTime: last.time }, skipped: 'holding' };
    }

    const key = actionKey(action, position);

    if (memory.lastBarTime === last.time && memory.lastKey === key) {
        return { signal: null, memory, skipped: 'same-bar' };
    }
    if (memory.lastKey === key) {
        // Still true, already reported. Silence is correct.
        return { signal: null, memory: { ...memory, lastBarTime: last.time }, skipped: 'no-change' };
    }
    if (memory.lastFiredAt != null && now - memory.lastFiredAt < cooldownMs) {
        return { signal: null, memory: { ...memory, lastKey: key, lastBarTime: last.time }, skipped: 'cooldown' };
    }

    // `rest` and `setStop` are backtest-only mechanics: a resting order is placed through
    // the order ticket, and a trailing stop has no meaning until a position exists here.
    if (action.kind !== 'enter' && action.kind !== 'exit') {
        return { signal: null, memory: { ...memory, lastKey: key, lastBarTime: last.time }, skipped: 'holding' };
    }

    const side: PaperSide =
        action.kind === 'enter' ? action.side : position && position.qty > 0 ? 'sell' : 'buy';

    const signal: StrategySignal = {
        id: `${strategy.id}:${symbol}:${last.time}:${key}`,
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol,
        market,
        timeframe: input.timeframe,
        intent: action.kind,
        side,
        price: last.close,
        stop: action.kind === 'enter' ? action.stop : undefined,
        target: action.kind === 'enter' ? action.target : undefined,
        reason: action.reason,
        params,
        barTime: last.time,
        createdAt: now,
    };

    return {
        signal,
        memory: { lastKey: key, lastFiredAt: now, lastBarTime: last.time },
    };
}

/**
 * Position size for a live signal.
 *
 * The backtester sizes from the `Sizing` the strategy returned; live, the size has to be
 * reconciled against real buying power and the guardrails, so it is computed here from
 * the signal's own stop and the caller's risk budget instead.
 */
export function sizeForSignal(input: {
    signal: StrategySignal;
    equityBase: number;
    priceBase: number;
    riskPct: number;
    fractional: boolean;
    maxOrderValueBase: number;
}): number {
    const { signal, equityBase, priceBase, riskPct, fractional, maxOrderValueBase } = input;
    if (!(priceBase > 0) || !(equityBase > 0)) return 0;

    let qty: number;
    if (signal.stop != null && signal.stop > 0 && signal.stop !== signal.price) {
        // Risk-based: the distance to the stop decides the quantity.
        const perUnitQuote = Math.abs(signal.price - signal.stop);
        const perUnitBase = perUnitQuote * (priceBase / signal.price);
        qty = perUnitBase > 0 ? (equityBase * (riskPct / 100)) / perUnitBase : 0;
    } else {
        // No stop: fall back to the order-value cap rather than inventing a stop.
        qty = maxOrderValueBase / priceBase;
    }

    const capped = Math.min(qty, maxOrderValueBase / priceBase, equityBase / priceBase);
    if (!Number.isFinite(capped) || capped <= 0) return 0;
    return fractional ? Number(capped.toFixed(6)) : Math.floor(capped);
}
