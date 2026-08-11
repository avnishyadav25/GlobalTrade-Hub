import type { Candle } from '@/lib/mockData';
import { runStrategyBacktest, type BacktestConfig, type StrategyBacktestResult, type Trade } from './backtest';
import { defaultParams, sanitiseParams, type Params, type Strategy } from './types';

// Walk-forward analysis: the difference between "this strategy worked" and "I found
// parameters that fit this data".
//
// A single backtest with hand-tuned parameters tells you almost nothing. Try enough
// combinations on one series and something will look brilliant purely by chance — with
// 5 parameters at 6 values each there are 7,776 candidates, and the best of 7,776 random
// numbers is impressive-looking noise.
//
// Walk-forward answers the only question that matters: having chosen parameters on data
// you HAD, how did they do on data you had not seen? This module always reports both,
// and the gap between them, because the gap IS the finding.

export interface ParamGrid {
    [key: string]: (number | string)[];
}

/**
 * Default ceiling on parameter combinations evaluated per fold.
 *
 * Every combination is a full backtest, so a 400-combination grid over 800 bars is 400
 * passes. Callers running in the browser should lower this and show progress; the point
 * of a cap is that an unbounded grid search is both slow AND the fastest route to an
 * overfitted result.
 */
export const MAX_COMBINATIONS = 400;

/**
 * Where a run has got to.
 *
 * A full run is `folds × (combinations + 1)` backtests — 1,600 at the defaults — so a
 * caller that cannot report progress can only offer a frozen tab. `done` counts
 * backtests actually finished, which is the only honest denominator for a progress bar:
 * counting folds alone jumps from 0% to 25% after a minute of apparent inactivity.
 */
export interface WalkForwardProgress {
    phase: 'optimising' | 'testing';
    /** Zero-based fold being worked on, and how many were planned. */
    fold: number;
    folds: number;
    /** Backtests finished so far, and the total this run will perform. */
    done: number;
    total: number;
}

export interface WalkForwardConfig extends Omit<BacktestConfig, 'params'> {
    grid: ParamGrid;
    /** Override the per-fold combination cap. */
    maxCombinations?: number;
    /** Share of each window used to choose parameters. The rest is the honest half. */
    trainFraction?: number;
    folds?: number;
    /** What to maximise in-sample. Defaults to net return per unit of drawdown. */
    objective?: (r: StrategyBacktestResult) => number;
    /**
     * Called as work completes. Side-effect only — it must not influence the result, so
     * that a progress-reporting run and a silent one produce identical output.
     */
    onProgress?: (p: WalkForwardProgress) => void;
}

export interface FoldResult {
    index: number;
    trainFrom: number;
    trainTo: number;
    testFrom: number;
    testTo: number;
    bestParams: Params;
    /** How the chosen parameters did on the data they were chosen from. */
    inSampleNetPct: number;
    /** How they did on data they had never seen. This is the number that counts. */
    outOfSampleNetPct: number;
    outOfSampleTrades: Trade[];
    combinationsTried: number;
}

export interface WalkForwardResult {
    folds: FoldResult[];
    inSampleNetPct: number;
    outOfSampleNetPct: number;
    /**
     * In-sample minus out-of-sample, in percentage points. A large positive number means
     * the parameters described the past rather than the market.
     */
    degradation: number;
    /** True when the winning parameters changed materially between folds. */
    unstable: boolean;
    /** Every out-of-sample trade, in order. The only trade list worth reading. */
    outOfSampleTrades: Trade[];
    warnings: string[];
}

/**
 * Default objective: return divided by the drawdown it took to get there.
 *
 * Maximising raw return alone reliably selects the most leveraged, most fragile
 * parameter set in the grid — it is the classic way to optimise straight into ruin.
 */
export function returnOverDrawdown(r: StrategyBacktestResult): number {
    // A parameter set that never traded has zero drawdown, which would otherwise score
    // as flawless and win the search outright.
    if (r.trades.length === 0) return Number.NEGATIVE_INFINITY;
    const dd = Math.abs(r.metrics.maxDD);
    return dd > 0 ? r.metrics.netPct / dd : r.metrics.netPct;
}

/** Every combination in the grid, in a stable order. */
export function expandGrid(grid: ParamGrid): Params[] {
    const keys = Object.keys(grid).filter((k) => Array.isArray(grid[k]) && grid[k].length > 0);
    if (!keys.length) return [{}];

    let out: Params[] = [{}];
    for (const key of keys) {
        const next: Params[] = [];
        for (const partial of out) {
            for (const value of grid[key]) next.push({ ...partial, [key]: value });
        }
        out = next;
    }
    return out;
}

/**
 * Exhaustive grid search over one window. Returns the best combination by `objective`.
 *
 * Deliberately NOT clever: no early stopping, no gradient, no random restarts. A smarter
 * search finds a better in-sample fit, and a better in-sample fit is the problem, not
 * the goal.
 */
export function optimise(
    base: Omit<BacktestConfig, 'params'>,
    grid: ParamGrid,
    opts: {
        objective?: (r: StrategyBacktestResult) => number;
        maxCombinations?: number;
        /** Fired after each combination. Side-effect only. */
        onCombination?: (completed: number, total: number) => void;
    } = {}
): { params: Params; score: number; tried: number; result: StrategyBacktestResult | null } {
    const objective = opts.objective ?? returnOverDrawdown;
    const combos = expandGrid(grid).slice(0, Math.max(1, opts.maxCombinations ?? MAX_COMBINATIONS));

    let bestParams = defaultParams(base.strategy);
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestResult: StrategyBacktestResult | null = null;

    for (let i = 0; i < combos.length; i++) {
        const params = sanitiseParams(base.strategy, combos[i]);
        const result = runStrategyBacktest({ ...base, params });
        const score = objective(result);
        if (Number.isFinite(score) && score > bestScore) {
            bestScore = score;
            bestParams = params;
            bestResult = result;
        }
        opts.onCombination?.(i + 1, combos.length);
    }

    return { params: bestParams, score: bestScore, tried: combos.length, result: bestResult };
}

function sliceBars(bars: Candle[], from: number, to: number): Candle[] {
    return bars.slice(Math.max(0, from), Math.min(bars.length, to));
}

/** Did the winning parameters actually change between folds? */
function paramsDiffer(a: Params, b: Params): boolean {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if (a[k] !== b[k]) return true;
    return false;
}

export function runWalkForward(config: WalkForwardConfig): WalkForwardResult {
    const { bars, grid, strategy } = config;
    const folds = Math.max(1, Math.floor(config.folds ?? 4));
    const trainFraction = Math.min(0.9, Math.max(0.1, config.trainFraction ?? 0.6));
    const objective = config.objective ?? returnOverDrawdown;
    const warnings: string[] = [];

    const cap = Math.max(1, config.maxCombinations ?? MAX_COMBINATIONS);
    const combos = expandGrid(grid);
    if (combos.length > cap) {
        warnings.push(
            `The grid has ${combos.length} combinations; only the first ${cap} per fold were evaluated. Narrow the grid rather than trusting a truncated search.`
        );
    }

    const windowSize = Math.floor(bars.length / folds);
    const warmup = Math.max(0, Math.floor(strategy.warmup(defaultParams(strategy))));
    const minWindow = Math.max(warmup * 2 + 10, 40);

    if (windowSize < minWindow) {
        return {
            folds: [],
            inSampleNetPct: 0,
            outOfSampleNetPct: 0,
            degradation: 0,
            unstable: false,
            outOfSampleTrades: [],
            warnings: [
                ...warnings,
                `${bars.length} bars split ${folds} ways gives ${windowSize} bars per fold, and this strategy needs at least ${minWindow}. Walk-forward was not run — a result from windows this short would be meaningless.`,
            ],
        };
    }

    const results: FoldResult[] = [];

    // Every fold runs `perFold` optimisation backtests plus one test backtest. Reporting
    // against this total keeps a progress bar honest across the whole run rather than
    // resetting each fold.
    const perFold = Math.min(combos.length, cap);
    const total = folds * (perFold + 1);
    let done = 0;

    for (let f = 0; f < folds; f++) {
        const windowFrom = f * windowSize;
        const windowTo = f === folds - 1 ? bars.length : windowFrom + windowSize;
        const splitAt = windowFrom + Math.floor((windowTo - windowFrom) * trainFraction);

        const trainBars = sliceBars(bars, windowFrom, splitAt);
        // The test window carries the warm-up tail of the training window, otherwise the
        // strategy starts every fold blind and the out-of-sample result is understated.
        const testBars = sliceBars(bars, Math.max(windowFrom, splitAt - warmup - 1), windowTo);

        if (trainBars.length < minWindow || testBars.length < warmup + 3) continue;

        const foldStart = done;
        const chosen = optimise({ ...config, bars: trainBars }, grid, {
            objective,
            maxCombinations: cap,
            onCombination: (completed) => {
                done = foldStart + completed;
                config.onProgress?.({ phase: 'optimising', fold: f, folds, done, total });
            },
        });

        config.onProgress?.({ phase: 'testing', fold: f, folds, done, total });
        const test = runStrategyBacktest({ ...config, bars: testBars, params: chosen.params });
        done = foldStart + perFold + 1;

        results.push({
            index: f,
            trainFrom: windowFrom,
            trainTo: splitAt,
            testFrom: splitAt,
            testTo: windowTo,
            bestParams: chosen.params,
            inSampleNetPct: chosen.result?.metrics.netPct ?? 0,
            outOfSampleNetPct: test.metrics.netPct,
            outOfSampleTrades: test.trades,
            combinationsTried: chosen.tried,
        });
    }

    if (!results.length) {
        return {
            folds: [], inSampleNetPct: 0, outOfSampleNetPct: 0, degradation: 0,
            unstable: false, outOfSampleTrades: [],
            warnings: [...warnings, 'No fold had enough bars to both choose parameters and test them.'],
        };
    }

    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const inSampleNetPct = mean(results.map((r) => r.inSampleNetPct));
    const outOfSampleNetPct = mean(results.map((r) => r.outOfSampleNetPct));

    // Parameters that jump around between folds describe the noise in each window, not
    // a property of the market. That is worth saying even when the returns look fine.
    const unstable = results.some((r, i) => i > 0 && paramsDiffer(r.bestParams, results[i - 1].bestParams));

    const degradation = inSampleNetPct - outOfSampleNetPct;
    if (degradation > Math.abs(inSampleNetPct) * 0.5 && inSampleNetPct > 0) {
        warnings.push(
            `Out-of-sample return is ${degradation.toFixed(1)} points below in-sample. That gap is the cost of choosing parameters on the same data you measured them with.`
        );
    }
    if (unstable) {
        warnings.push('The winning parameters changed between folds, which suggests they are fitting each window rather than describing the market.');
    }
    if (results.length < 3) {
        warnings.push(`Only ${results.length} fold${results.length === 1 ? '' : 's'} — too few to say anything about stability.`);
    }

    return {
        folds: results,
        inSampleNetPct,
        outOfSampleNetPct,
        degradation,
        unstable,
        outOfSampleTrades: results.flatMap((r) => r.outOfSampleTrades),
        warnings,
    };
}
