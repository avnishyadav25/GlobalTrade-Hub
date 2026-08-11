import type { PaperSide } from '@/lib/paperEngine';
import type { ParamSpec, Sizing, StrategyContext } from '../types';
import { num } from '../types';

// Shared parameter specs and helpers.
//
// Twenty strategies each re-declaring "size %" produced twenty subtly different help
// texts and bounds. These are the definitions; a strategy that needs something else
// declares its own.

export const SIZE_PCT: ParamSpec = {
    key: 'sizePct',
    label: 'Position size',
    help: 'Percentage of your equity to commit per trade. A few percent leaves room to be wrong repeatedly and still be trading.',
    type: 'pct',
    min: 1,
    max: 100,
    step: 1,
    default: 20,
};

export const RISK_PCT: ParamSpec = {
    key: 'riskPct',
    label: 'Risk per trade',
    help: 'Percentage of equity you accept losing if the stop triggers. The quantity is worked out from this and the stop distance, not from the cash you happen to have.',
    type: 'pct',
    min: 0.1,
    max: 5,
    step: 0.1,
    default: 1,
};

export const DIRECTION: ParamSpec = {
    key: 'direction',
    label: 'Direction',
    help: 'Long only, short only, or both. Shorting has no ceiling on its losses — start long only.',
    type: 'choice',
    choices: [
        { value: 'long', label: 'Long only' },
        { value: 'short', label: 'Short only' },
        { value: 'both', label: 'Both' },
    ],
    default: 'long',
};

export const ATR_PERIOD: ParamSpec = {
    key: 'atrPeriod',
    label: 'ATR period',
    help: 'Bars used to measure average true range, which sets the stop distance.',
    type: 'int',
    min: 2,
    max: 100,
    default: 14,
};

export const ATR_MULT: ParamSpec = {
    key: 'atrMult',
    label: 'Stop distance (ATR)',
    help: 'Stop placed this many ATRs away. Tighter means more stop-outs on ordinary noise; wider means a bigger loss when you are wrong.',
    type: 'float',
    min: 0.5,
    max: 10,
    step: 0.5,
    default: 2,
};

/** Does the configured direction permit this side? */
export function allows(direction: string, side: PaperSide): boolean {
    if (direction === 'both') return true;
    return direction === 'long' ? side === 'buy' : side === 'sell';
}

export function equityPct(pct: number): Sizing {
    return { kind: 'equityPct', pct };
}

/**
 * Stop price `mult` ATRs away from `price`, on the protective side.
 * Null when ATR has not warmed up — the caller must then not trade, rather than
 * substituting an arbitrary distance.
 */
export function atrStop(ctx: StrategyContext, side: PaperSide, price: number, period: number, mult: number): number | null {
    const atr = ctx.ind.atr(period);
    if (atr == null || atr <= 0) return null;
    return side === 'buy' ? price - atr * mult : price + atr * mult;
}

/** Risk-based sizing from an ATR stop, or null when ATR is not available yet. */
export function atrRiskSizing(ctx: StrategyContext, period: number, mult: number, riskPct: number): Sizing | null {
    const atr = ctx.ind.atr(period);
    if (atr == null || atr <= 0) return null;
    return { kind: 'atrRisk', pct: riskPct, atrMult: mult, atr };
}

export const p = num;
