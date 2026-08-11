import type { Candle } from '@/lib/mockData';
import type { Market } from '@/lib/constants';
import type { Params, Strategy } from './types';
import { runStrategyBacktest, computeMetrics, type Metrics, type StrategyBacktestResult, type Trade } from './backtest';
import type { Product } from '@/lib/charges';

/**
 * Portfolio backtesting across several instruments.
 *
 * WHAT THIS MODELS, precisely, because the distinction decides whether the numbers
 * mean anything:
 *
 * Capital is divided into fixed **sleeves**, one per symbol, and each sleeve runs the
 * strategy independently on its own instrument with its own allocation. Sleeves do
 * NOT lend to each other — a symbol sitting in cash does not fund a larger position
 * elsewhere, and a sleeve that runs out of capital does not borrow.
 *
 * That is a real allocation policy, and it is how multi-strategy books are usually
 * run. It is NOT a shared cash pool where instruments compete for capital, which
 * would need the per-symbol engines interleaved on one timeline and one ledger. That
 * is not built, and `sharedCapital` in the result says so rather than implying it.
 *
 * What the sleeve model does give you, and a per-symbol run cannot:
 *
 *   - a portfolio drawdown computed from the COMBINED curve. This is the whole point:
 *     portfolio drawdown is not the average of the individual drawdowns, because the
 *     sleeves trough at different times. The gap between the two is diversification,
 *     measured rather than asserted.
 *   - a correlation matrix across sleeve returns, which is what tells you whether six
 *     positions are six bets or one.
 */

export interface PortfolioLeg {
    symbol: string;
    market: Market;
    bars: Candle[];
    /** Optional per-leg weight. Omitted legs share what is left, equally. */
    weight?: number;
}

export interface PortfolioConfig {
    strategy: Strategy;
    params?: Params;
    legs: PortfolioLeg[];
    barSeconds: number;
    startingCapital: number;
    product?: Product;
    squareOff?: boolean;
}

export interface LegResult {
    symbol: string;
    market: Market;
    allocation: number;
    result: StrategyBacktestResult;
    /** Contribution to the portfolio's net P&L, in base currency. */
    pnl: number;
}

export interface PortfolioResult {
    legs: LegResult[];
    /** Combined equity, on the union timeline. */
    equity: number[];
    /** Timestamps for `equity`, so the curve can be plotted against real dates. */
    timeline: number[];
    drawdown: number[];
    metrics: Metrics;
    /** Symbol-by-symbol correlation of sleeve returns, in `legs` order. */
    correlation: number[][];
    /**
     * Weighted average of the individual sleeve drawdowns, against the portfolio's
     * own. A portfolio drawdown much shallower than this is diversification working;
     * one that matches it means the sleeves fell together.
     */
    weightedLegMaxDD: number;
    suppressed: string[];
    warnings: string[];
    /** Always false today — sleeves are funded independently. See the module note. */
    sharedCapital: boolean;
}

/** Allocate capital across legs, honouring explicit weights and splitting the rest. */
export function allocate(legs: PortfolioLeg[], capital: number): number[] {
    const explicit = legs.reduce((n, l) => n + (l.weight ?? 0), 0);
    if (explicit > 1.000001) throw new Error(`Explicit weights sum to ${explicit.toFixed(3)}, which is more than the whole portfolio.`);

    const unweighted = legs.filter((l) => l.weight == null).length;
    const share = unweighted > 0 ? (1 - explicit) / unweighted : 0;
    return legs.map((l) => capital * (l.weight ?? share));
}

/**
 * Forward-fill a leg's equity onto the union timeline.
 *
 * Legs rarely share a bar timeline — different holidays, different listing dates,
 * different provider coverage. Before a leg's first bar its sleeve is simply cash, so
 * it contributes its allocation; after a gap it holds its last known value. Summing
 * un-aligned curves by index instead would silently compare different dates, which is
 * the kind of error that produces a beautiful and meaningless equity curve.
 */
function alignTo(timeline: number[], bars: Candle[], equity: number[], allocation: number): number[] {
    const out = new Array<number>(timeline.length);
    let cursor = 0;
    let last = allocation;

    for (let t = 0; t < timeline.length; t++) {
        while (cursor < bars.length && bars[cursor].time <= timeline[t]) {
            // The engine samples equity from bar 1 onward, so equity[k] belongs to
            // bars[k + 1]. Bar 0 has no sample and the sleeve is still its opening
            // allocation there. Indexing equity by the bar cursor would shift every
            // leg one bar early — invisible on a chart, wrong in every metric.
            if (cursor > 0) last = equity[cursor - 1] ?? last;
            cursor++;
        }
        out[t] = last;
    }
    return out;
}

/** Pearson correlation of two equal-length return series. */
export function correlate(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    if (n < 2) return 0;
    let ma = 0, mb = 0;
    for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;

    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
        const x = a[i] - ma, y = b[i] - mb;
        num += x * y; da += x * x; db += y * y;
    }
    // A sleeve that never traded has zero variance; correlation is undefined, not zero
    // with confidence. Reporting 0 is the honest neutral here, and `warnings` says why.
    if (da === 0 || db === 0) return 0;
    return num / Math.sqrt(da * db);
}

const pctReturns = (curve: number[]): number[] => {
    const out: number[] = [];
    for (let i = 1; i < curve.length; i++) {
        out.push(curve[i - 1] > 0 ? curve[i] / curve[i - 1] - 1 : 0);
    }
    return out;
};

export function runPortfolioBacktest(config: PortfolioConfig): PortfolioResult {
    const { strategy, params, legs, barSeconds, startingCapital, product, squareOff } = config;

    if (!legs.length) throw new Error('A portfolio backtest needs at least one instrument.');
    if (strategy.shape !== 'single') {
        // A pair or universe strategy already consumes several series through ctx.other.
        // Running it once per leg would silently drop that second series.
        throw new Error(`${strategy.name} is a ${strategy.shape} strategy — it consumes multiple series itself and cannot be run as independent sleeves.`);
    }

    const allocations = allocate(legs, startingCapital);
    const warnings: string[] = [];

    const legResults: LegResult[] = legs.map((leg, i) => {
        const result = runStrategyBacktest({
            strategy,
            params,
            symbol: leg.symbol,
            market: leg.market,
            bars: leg.bars,
            barSeconds,
            startingCapital: allocations[i],
            product,
            squareOff,
        });
        return {
            symbol: leg.symbol,
            market: leg.market,
            allocation: allocations[i],
            result,
            pnl: result.finalValue - allocations[i],
        };
    });

    // Union timeline, so legs with different histories combine on dates rather than
    // on array index.
    const timeline = [...new Set(legs.flatMap((l) => l.bars.map((b) => b.time)))].sort((a, b) => a - b);

    const aligned = legResults.map((lr, i) => alignTo(timeline, legs[i].bars, lr.result.equity, lr.allocation));
    const equity = timeline.map((_, t) => aligned.reduce((sum, curve) => sum + curve[t], 0));

    // Drawdown from the COMBINED curve — the number a per-symbol run cannot give you.
    const drawdown: number[] = [];
    let peak = equity[0] ?? startingCapital;
    let ddBars = 0, maxDDBars = 0;
    for (const v of equity) {
        if (v >= peak) { peak = v; ddBars = 0; } else { ddBars++; maxDDBars = Math.max(maxDDBars, ddBars); }
        drawdown.push(peak > 0 ? (v / peak - 1) * 100 : 0);
    }

    const returns = aligned.map(pctReturns);
    const correlation = returns.map((a) => returns.map((b) => correlate(a, b)));

    const idle = legResults.filter((l) => l.result.metrics.trades === 0).map((l) => l.symbol);
    if (idle.length) {
        warnings.push(`${idle.length} of ${legs.length} instruments took no trades (${idle.join(', ')}). Their correlation rows are 0 because a flat sleeve has no variance, not because they are uncorrelated.`);
    }

    const trades: Trade[] = legResults.flatMap((l) => l.result.trades);
    const finalValue = legResults.reduce((n, l) => n + l.result.finalValue, 0);
    const barsInPosition = legResults.reduce((n, l) => n + l.result.metrics.exposure * l.result.metrics.bars, 0);
    const tradedNotional = legResults.reduce((n, l) => n + l.result.metrics.turnover * l.allocation, 0);

    // Benchmark: hold every instrument at its sleeve weight over the same window, with
    // the same costs. Weighted by allocation so it is comparable to the strategy.
    const benchmarkPct = legResults.reduce(
        (n, l) => n + (l.result.metrics.benchmarkPct * l.allocation) / startingCapital, 0
    );

    const weightedLegMaxDD = legResults.reduce(
        (n, l) => n + (l.result.metrics.maxDD * l.allocation) / startingCapital, 0
    );

    const metrics = computeMetrics({
        trades,
        equity,
        drawdown,
        startingCapital,
        finalValue,
        market: legs[0].market,
        barSeconds,
        barsInPosition,
        tradedNotional,
        maxDDBars,
        benchmarkPct,
        bars: timeline.length,
    });

    // Every leg's suppressions apply to the portfolio too — a portfolio of six sleeves
    // with four trades each has 24 trades but not 24 independent observations of one
    // edge, so nothing is un-suppressed by aggregating.
    const suppressed = [...new Set(legResults.flatMap((l) => l.result.suppressed))];

    return {
        legs: legResults,
        equity,
        timeline,
        drawdown,
        metrics,
        correlation,
        weightedLegMaxDD,
        suppressed,
        warnings: [...new Set([...warnings, ...legResults.flatMap((l) => l.result.warnings)])],
        sharedCapital: false,
    };
}
