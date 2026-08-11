import type { Candle } from '@/lib/mockData';
import type { Market } from '@/lib/constants';
import { isFractional, TAKER_SLIPPAGE_BPS } from '@/lib/paperEngine';
import { chargeTotal, type Product } from '@/lib/charges';
import { shouldSquareOff } from '@/lib/sessions';
import { createContext } from './context';
import { sanitiseParams, type Action, type Params, type PositionView, type Sizing, type Strategy, type StrategyEvent } from './types';

// The strategy backtester.
//
// Execution semantics are carried over from the original engine unchanged, because they
// were audited and are the part that decides whether the numbers mean anything:
//   * a signal is computed on bar i-1's CLOSE and filled at bar i's OPEN
//   * stops and targets are checked intrabar against high/low, not just the close
//   * a bar that gaps through a level fills at the open, not at the level
//   * when one bar touches both stop and target, the STOP resolves first — bar ordering
//     is unknowable, so the conservative reading is the honest one
//   * a position still open on the last bar is force-closed and recorded
//
// What is new: shorts, real per-order costs, sizing from risk rather than notional,
// a returned trade list, a buy-and-hold benchmark on every run, and a sample-size gate
// that refuses to print a Sharpe ratio computed from nine trades.

/* ------------------------------------------------------------------- config */

export interface BacktestConfig {
    strategy: Strategy;
    params?: Params;
    symbol: string;
    market: Market;
    bars: Candle[];
    barSeconds: number;
    startingCapital: number;
    /** Additional aligned series, keyed by the role the strategy declared. */
    others?: Record<string, Candle[]>;
    events?: StrategyEvent[];
    /** Drives STT and stamp duty. Intraday is the default, as in the paper engine. */
    product?: Product;
    /** Flatten before the session close, as an Indian MIS position must be. */
    squareOff?: boolean;
}

export interface Trade {
    side: 'long' | 'short';
    entryIndex: number;
    exitIndex: number;
    entryTime: number;
    exitTime: number;
    entryPrice: number;
    exitPrice: number;
    qty: number;
    grossPnl: number;
    fees: number;
    /** Net of every charge on both legs. */
    pnl: number;
    ret: number;
    /** Result in units of the risk taken. Null when the trade had no stop. */
    rMultiple: number | null;
    reason: 'signal' | 'stop' | 'target' | 'squareoff' | 'forced';
    entryReason: string;
    exitReason: string;
    /** Worst and best unrealised excursion while the trade was open, as a fraction. */
    mae: number;
    mfe: number;
}

export interface Metrics {
    netPct: number;
    cagr: number | null;
    maxDD: number;
    /** Longest stretch below the previous equity peak, in bars. */
    maxDDBars: number;
    sharpe: number | null;
    sortino: number | null;
    calmar: number | null;
    winRate: number | null;
    profitFactor: number | null;
    expectancy: number | null;
    avgWin: number;
    avgLoss: number;
    payoff: number | null;
    maxConsecutiveLosses: number;
    /** Fraction of bars holding a position. */
    exposure: number;
    /** Traded notional as a multiple of starting capital. */
    turnover: number;
    trades: number;
    bars: number;
    /** Buy and hold over the same window, same costs. The number to beat. */
    benchmarkPct: number;
}

export interface StrategyBacktestResult {
    trades: Trade[];
    equity: number[];
    benchmark: number[];
    drawdown: number[];
    metrics: Metrics;
    /** Statistics withheld because the sample cannot support them. */
    suppressed: string[];
    warnings: string[];
    finalValue: number;
    params: Params;
    monthEnd: Map<string, number>;
}

/* ---------------------------------------------------------------- annualising */

const TRADING_DAYS: Record<string, number> = { crypto: 365, us: 252, india: 252, forex: 260, commodity: 252 };
const SESSION_SECONDS: Record<string, number> = { crypto: 86400, us: 23400, india: 22500, forex: 86400, commodity: 82800 };

/**
 * Bars in a trading year, from the market's real session length.
 *
 * The old engine used `365 * 24 * 3600 / barSeconds` for every market — calendar time.
 * For 15-minute NSE bars that claims 35,040 bars a year against a true ~6,300, which
 * inflates an annualised Sharpe by a factor of about 2.4.
 */
export function barsPerYear(market: Market, barSeconds: number): number {
    const days = TRADING_DAYS[market] ?? 252;
    const session = SESSION_SECONDS[market] ?? 23400;
    if (barSeconds >= 86_400) return Math.max(1, (days * 86_400) / barSeconds);
    return Math.max(1, (days * session) / barSeconds);
}

/* ------------------------------------------------------------ sample-size gate */

/** Below this many trades, ratio statistics are noise dressed as insight. */
export const MIN_TRADES_FOR_STATS = 30;
/** Below this many bars, an annualised figure is an extrapolation, not a measurement. */
export const MIN_BARS_FOR_ANNUALISED = 200;

/* --------------------------------------------------------------------- engine */

interface OpenPosition extends PositionView {
    entryTime: number;
    entryFee: number;
    entryReason: string;
    /** Worst/best price seen while open, for MAE/MFE. */
    worst: number;
    best: number;
}

export function runStrategyBacktest(config: BacktestConfig): StrategyBacktestResult {
    const { strategy, symbol, market, bars, barSeconds, startingCapital } = config;
    const params = sanitiseParams(strategy, config.params ?? {});
    const product: Product = config.product ?? 'intraday';
    const warnings: string[] = [];
    const slip = TAKER_SLIPPAGE_BPS / 10_000;
    const fractional = isFractional(symbol);

    const costOf = (notional: number, side: 'buy' | 'sell', qty: number) =>
        chargeTotal({ market, side, product, notionalBase: Math.abs(notional), maker: false, qty });

    if (bars.length < 2) {
        return emptyResult(params, startingCapital, ['Not enough bars to run anything.']);
    }

    const warmup = Math.max(0, Math.floor(strategy.warmup(params)));
    if (bars.length <= warmup + 2) {
        warnings.push(
            `This strategy needs ${warmup} bars of history before it can signal, and only ${bars.length} were available.`
        );
    }

    const handle = createContext({ bars, market, barSeconds, params, others: config.others, events: config.events });

    let cash = startingCapital;
    let equityVal = startingCapital;
    // Held in an object rather than a bare `let`: the helpers below mutate it, and
    // TypeScript's flow analysis cannot see through a closure assignment.
    const book: { pos: OpenPosition | null } = { pos: null };

    const trades: Trade[] = [];
    const equity: number[] = [];
    const benchmark: number[] = [];
    const drawdown: number[] = [];
    const monthEnd = new Map<string, number>();

    let peak = startingCapital;
    let barsInPosition = 0;
    let tradedNotional = 0;
    let ddBars = 0;
    let maxDDBars = 0;

    // Buy and hold over exactly the same window, paying the same charges. Without this
    // there is nothing to compare a result against: +8% is excellent if the instrument
    // fell 20% and poor if it doubled.
    const benchEntry = bars[1].open * (1 + slip);
    const benchQtyRaw = startingCapital / benchEntry;
    const benchQty = fractional ? benchQtyRaw : Math.floor(benchQtyRaw);
    const benchEntryFee = costOf(benchQty * benchEntry, 'buy', benchQty);
    const benchCash = startingCapital - benchQty * benchEntry - benchEntryFee;

    const mark = (price: number) => cash + (book.pos ? book.pos.qty * price : 0);

    const closePosition = (
        price: number,
        index: number,
        reason: Trade['reason'],
        exitReason: string
    ) => {
        if (!book.pos) return;
        const p = book.pos;
        const isLong = p.qty > 0;
        const qty = Math.abs(p.qty);
        // Selling out of a long, buying back into a short.
        const fill = isLong ? price * (1 - slip) : price * (1 + slip);
        const exitFee = costOf(qty * fill, isLong ? 'sell' : 'buy', qty);

        cash += p.qty * fill - exitFee;
        tradedNotional += qty * fill;

        const grossPnl = p.qty * (fill - p.avgPrice);
        const fees = p.entryFee + exitFee;
        const risk = p.stop != null ? Math.abs(p.avgPrice - p.stop) * qty : null;

        trades.push({
            side: isLong ? 'long' : 'short',
            entryIndex: p.entryIndex,
            exitIndex: index,
            entryTime: p.entryTime,
            exitTime: bars[index].time,
            entryPrice: p.avgPrice,
            exitPrice: fill,
            qty,
            grossPnl,
            fees,
            pnl: grossPnl - fees,
            ret: p.avgPrice !== 0 ? (isLong ? fill / p.avgPrice - 1 : p.avgPrice / fill - 1) : 0,
            rMultiple: risk && risk > 0 ? (grossPnl - fees) / risk : null,
            reason,
            entryReason: p.entryReason,
            exitReason,
            mae: isLong ? p.worst / p.avgPrice - 1 : 1 - p.worst / p.avgPrice,
            mfe: isLong ? p.best / p.avgPrice - 1 : 1 - p.best / p.avgPrice,
        });
        book.pos = null;
    };

    const sizeFor = (sizing: Sizing, fill: number, eq: number): number => {
        let raw = 0;
        if (sizing.kind === 'equityPct') {
            raw = (eq * (sizing.pct / 100)) / fill;
        } else if (sizing.kind === 'riskPct') {
            const perUnit = Math.abs(fill - sizing.stop);
            // A stop at the entry price implies infinite size. Refuse rather than clamp.
            raw = perUnit > 0 ? (eq * (sizing.pct / 100)) / perUnit : 0;
        } else {
            const perUnit = Math.abs(sizing.atrMult * sizing.atr);
            raw = perUnit > 0 ? (eq * (sizing.pct / 100)) / perUnit : 0;
        }
        if (!Number.isFinite(raw) || raw <= 0) return 0;
        const qty = fractional ? raw : Math.floor(raw);
        // Never let a book.pos exceed the account: risk sizing with a tight stop can
        // demand far more notional than there is capital.
        const maxQty = fractional ? eq / fill : Math.floor(eq / fill);
        return Math.min(qty, maxQty);
    };

    const openPosition = (action: Extract<Action, { kind: 'enter' }>, price: number, index: number) => {
        const isLong = action.side === 'buy';
        const fill = isLong ? price * (1 + slip) : price * (1 - slip);
        const qty = sizeFor(action.sizing, fill, equityVal);
        if (qty <= 0) return;

        const entryFee = costOf(qty * fill, action.side, qty);
        const signed = isLong ? qty : -qty;

        cash -= signed * fill;
        cash -= entryFee;
        tradedNotional += qty * fill;

        book.pos = {
            qty: signed,
            avgPrice: fill,
            entryIndex: index,
            entryTime: bars[index].time,
            entryFee,
            entryReason: action.reason,
            stop: action.stop,
            target: action.target,
            worst: fill,
            best: fill,
        };
    };

    /**
     * Resolve stop and target against one bar's range.
     *
     * `enteredThisBar` matters: a book.pos opened at this bar's OPEN cannot also have
     * gapped through a level at that same open — but it is still exposed to the rest of
     * the bar. Skipping the entry bar entirely (as the original engine did) meant a
     * strategy that bought immediately before a crash appeared to survive it untouched.
     */
    const checkProtective = (bar: Candle, i: number, enteredThisBar: boolean) => {
        if (!book.pos) return;
        const p = book.pos;
        const isLong = p.qty > 0;
        const { stop, target } = p;

        if (!enteredThisBar) {
            if (stop != null && (isLong ? bar.open <= stop : bar.open >= stop)) {
                closePosition(bar.open, i, 'stop', 'gapped through the stop');
                return;
            }
            if (target != null && (isLong ? bar.open >= target : bar.open <= target)) {
                closePosition(bar.open, i, 'target', 'gapped through the target');
                return;
            }
        }
        // Stop before target: one bar touching both is ambiguous, and the conservative
        // reading is the only honest one.
        if (stop != null && (isLong ? bar.low <= stop : bar.high >= stop)) {
            closePosition(stop, i, 'stop', 'stop hit');
            return;
        }
        if (target != null && (isLong ? bar.high >= target : bar.low <= target)) {
            closePosition(target, i, 'target', 'target hit');
        }
    };

    for (let i = 1; i < bars.length; i++) {
        const bar = bars[i];

        // 1. Protective exits for a book.pos held INTO this bar.
        checkProtective(bar, i, false);

        // 2. The strategy decides on bar i-1's CLOSE — it cannot see bar i at all.
        const ctx = handle.seek(i - 1, book.pos, equityVal);
        let action: Action = { kind: 'hold' };
        if (i - 1 >= warmup) {
            action = strategy.onBar(ctx);
        }

        // 3. Execute at bar i's OPEN.
        if (action.kind === 'exit' && book.pos) {
            closePosition(bar.open, i, 'signal', action.reason);
        } else if (action.kind === 'enter') {
            if (book.pos && Math.sign(book.pos.qty) !== (action.side === 'buy' ? 1 : -1)) {
                closePosition(bar.open, i, 'signal', 'reversed by a new signal');
            }
            if (!book.pos) {
                openPosition(action, bar.open, i);
                // Exposed to the remainder of the bar we just entered on.
                checkProtective(bar, i, true);
            }
        }

        // 4. Intraday square-off, before the broker does it and charges for it.
        if (book.pos && config.squareOff && shouldSquareOff(market, bar.time * 1000)) {
            closePosition(bar.close, i, 'squareoff', 'flattened before the session close');
        }

        // 5. Mark to market.
        if (book.pos) {
            barsInPosition++;
            book.pos.worst = book.pos.qty > 0 ? Math.min(book.pos.worst, bar.low) : Math.max(book.pos.worst, bar.high);
            book.pos.best = book.pos.qty > 0 ? Math.max(book.pos.best, bar.high) : Math.min(book.pos.best, bar.low);
        }
        equityVal = mark(bar.close);
        equity.push(equityVal);
        benchmark.push(benchCash + benchQty * bar.close);

        if (equityVal >= peak) {
            peak = equityVal;
            ddBars = 0;
        } else {
            ddBars++;
            maxDDBars = Math.max(maxDDBars, ddBars);
        }
        drawdown.push(peak > 0 ? (equityVal / peak - 1) * 100 : 0);

        const d = new Date(bar.time * 1000);
        monthEnd.set(`${d.getUTCFullYear()}-${d.getUTCMonth()}`, equityVal);
    }

    // Close anything still open, so the trade list reconciles with the equity curve.
    if (book.pos) {
        const last = bars[bars.length - 1];
        closePosition(last.close, bars.length - 1, 'forced', 'series ended with the book.pos open');
        equityVal = cash;
        if (equity.length) equity[equity.length - 1] = equityVal;
        warnings.push('A book.pos was open at the end of the series and was closed at the final price.');
    }

    const benchFinal = benchCash + benchQty * bars[bars.length - 1].close;
    const benchExitFee = costOf(benchQty * bars[bars.length - 1].close, 'sell', benchQty);
    const benchmarkPct =
        startingCapital > 0 ? ((benchFinal - benchExitFee) / startingCapital - 1) * 100 : 0;

    const metrics = computeMetrics({
        trades,
        equity,
        drawdown,
        startingCapital,
        finalValue: equityVal,
        market,
        barSeconds,
        barsInPosition,
        tradedNotional,
        maxDDBars,
        benchmarkPct,
        bars: bars.length,
    });

    const suppressed = suppressionList(trades.length, equity.length);
    if (suppressed.length) {
        warnings.push(
            `${trades.length} trade${trades.length === 1 ? '' : 's'} over ${equity.length} bars is too small a sample for ${suppressed.join(', ')}. Those are withheld rather than shown as if they meant something.`
        );
    }

    return {
        trades,
        equity,
        benchmark,
        drawdown,
        metrics,
        suppressed,
        warnings,
        finalValue: equityVal,
        params,
        monthEnd,
    };
}

/* -------------------------------------------------------------------- metrics */

function suppressionList(tradeCount: number, barCount: number): string[] {
    const out: string[] = [];
    if (tradeCount < MIN_TRADES_FOR_STATS) out.push('win rate', 'profit factor', 'expectancy');
    if (barCount < MIN_BARS_FOR_ANNUALISED || tradeCount < MIN_TRADES_FOR_STATS) {
        out.push('Sharpe', 'Sortino', 'Calmar', 'CAGR');
    }
    return [...new Set(out)];
}

interface MetricInput {
    trades: Trade[];
    equity: number[];
    drawdown: number[];
    startingCapital: number;
    finalValue: number;
    market: Market;
    barSeconds: number;
    barsInPosition: number;
    tradedNotional: number;
    maxDDBars: number;
    benchmarkPct: number;
    bars: number;
}

export function computeMetrics(input: MetricInput): Metrics {
    const { trades, equity, drawdown, startingCapital, finalValue } = input;
    const suppressed = new Set(suppressionList(trades.length, equity.length));
    const hide = (name: string) => suppressed.has(name);

    const netPct = startingCapital > 0 ? (finalValue / startingCapital - 1) * 100 : 0;
    const maxDD = drawdown.length ? drawdown.reduce((a, b) => Math.min(a, b), 0) : 0;

    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);
    const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
    const avgWin = wins.length ? grossWin / wins.length : 0;
    const avgLoss = losses.length ? grossLoss / losses.length : 0;

    let consecutive = 0;
    let maxConsecutiveLosses = 0;
    for (const t of trades) {
        consecutive = t.pnl < 0 ? consecutive + 1 : 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutive);
    }

    // Per-bar returns, annualised by the market's REAL session length.
    const rets: number[] = [];
    for (let i = 1; i < equity.length; i++) {
        if (equity[i - 1] > 0) rets.push(equity[i] / equity[i - 1] - 1);
    }
    const periods = barsPerYear(input.market, input.barSeconds);

    let sharpe: number | null = null;
    let sortino: number | null = null;
    if (rets.length > 2) {
        const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
        const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
        const sd = Math.sqrt(variance);
        if (sd > 0) sharpe = (mean / sd) * Math.sqrt(periods);

        // Sortino punishes only downside deviation — the asymmetry Sharpe misses.
        const downside = rets.filter((r) => r < 0);
        if (downside.length > 1) {
            const dv = downside.reduce((a, b) => a + b * b, 0) / downside.length;
            const dd = Math.sqrt(dv);
            if (dd > 0) sortino = (mean / dd) * Math.sqrt(periods);
        }
    }

    const years = equity.length / periods;
    let cagr: number | null = null;
    if (years > 0 && startingCapital > 0 && finalValue > 0) {
        cagr = ((finalValue / startingCapital) ** (1 / years) - 1) * 100;
    }
    const calmar = cagr != null && maxDD < 0 ? cagr / Math.abs(maxDD) : null;

    const winRate = trades.length ? (wins.length / trades.length) * 100 : null;
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : null;
    const payoff = avgLoss > 0 ? avgWin / avgLoss : null;
    const expectancy =
        trades.length && winRate != null
            ? (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss
            : null;

    return {
        netPct,
        cagr: hide('CAGR') ? null : cagr,
        maxDD,
        maxDDBars: input.maxDDBars,
        sharpe: hide('Sharpe') ? null : sharpe,
        sortino: hide('Sortino') ? null : sortino,
        calmar: hide('Calmar') ? null : calmar,
        winRate: hide('win rate') ? null : winRate,
        profitFactor: hide('profit factor') ? null : profitFactor,
        expectancy: hide('expectancy') ? null : expectancy,
        avgWin,
        avgLoss,
        payoff,
        maxConsecutiveLosses,
        exposure: equity.length ? input.barsInPosition / equity.length : 0,
        turnover: startingCapital > 0 ? input.tradedNotional / startingCapital : 0,
        trades: trades.length,
        bars: input.bars,
        benchmarkPct: input.benchmarkPct,
    };
}

function emptyResult(params: Params, startingCapital: number, warnings: string[]): StrategyBacktestResult {
    return {
        trades: [],
        equity: [],
        benchmark: [],
        drawdown: [],
        metrics: computeMetrics({
            trades: [], equity: [], drawdown: [], startingCapital, finalValue: startingCapital,
            market: 'us', barSeconds: 86_400, barsInPosition: 0, tradedNotional: 0,
            maxDDBars: 0, benchmarkPct: 0, bars: 0,
        }),
        suppressed: [],
        warnings,
        finalValue: startingCapital,
        params,
        monthEnd: new Map(),
    };
}
