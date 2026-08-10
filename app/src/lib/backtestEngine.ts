// Transparent backtesting engine: EMA-crossover + RSI filter with stop/target and
// % position sizing, run over candles supplied by the caller (real where a provider
// covers the instrument, otherwise a clearly-labelled synthetic series).
//
// Modelling choices that make the numbers defensible — see docs/AUDIT.md:
//  - Indicators return null during warm-up. They used to be seeded so that
//    emaFast[0] === emaSlow[0], which manufactured a crossover on bar 1 of EVERY
//    run, and RSI was pre-filled with a neutral 50 that disabled its own filter
//    exactly during the warm-up window.
//  - Signals are computed on bar i's close and executed at bar i+1's OPEN. Filling
//    at the same close you used to generate the signal is look-ahead.
//  - Stops and targets are checked intrabar against high/low, not just the close, and
//    a gap through the level fills at the open. Stop resolves before target when a
//    single bar touches both (conservative — bar ordering is unknowable).
//  - Fees and slippage come from the paper engine, so both engines model one world.
//  - A position still open on the last bar is force-closed and recorded, so the trade
//    list reconciles with the equity curve.

import { type Candle } from './mockData';
import { FEE_BPS_TAKER, TAKER_SLIPPAGE_BPS, marketOf } from './paperEngine';
import type { HeatRow } from '@/components/charts';

export interface BacktestParams {
    symbol: string;
    timeframe: string;
    startingCapital: number;
    fast: number;
    slow: number;
    rsiPeriod: number;
    rsiMax: number;
    stopPct: number;
    takePct: number;
    sizePct: number;
    seed: number;
}

export interface BacktestTrade {
    entryTime: number;
    exitTime: number;
    entry: number;
    exit: number;
    pnl: number;
    ret: number;
    reason: 'signal' | 'stop' | 'target' | 'forced';
}

export interface BacktestResult {
    metrics: { label: string; value: string; col?: string; sub: string }[];
    equity: number[];
    drawdown: number[];
    heatRows: HeatRow[];
    finalValue: number;
    netPct: number;
    maxDD: number;
    trades: number;
    /** Non-null only when there is enough data to be meaningful. */
    sharpe: number | null;
    profitFactor: number | null;
    warnings: string[];
}

export const DEFAULT_PARAMS: Omit<BacktestParams, 'symbol' | 'seed'> = {
    timeframe: '15m',
    startingCapital: 100000,
    fast: 9,
    slow: 21,
    rsiPeriod: 14,
    rsiMax: 70,
    stopPct: 2,
    takePct: 5,
    sizePct: 10,
};

/** Clamp user-entered params so a cleared field can't produce Infinity or NaN. */
export function sanitiseParams(p: BacktestParams): BacktestParams {
    const int = (n: number, min: number, max: number, d: number) =>
        Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
    const num = (n: number, min: number, max: number, d: number) =>
        Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
    const fast = int(p.fast, 2, 200, DEFAULT_PARAMS.fast);
    const slow = int(p.slow, 3, 400, DEFAULT_PARAMS.slow);
    return {
        ...p,
        fast: Math.min(fast, slow - 1), // fast must be strictly faster than slow
        slow,
        rsiPeriod: int(p.rsiPeriod, 2, 100, DEFAULT_PARAMS.rsiPeriod),
        rsiMax: num(p.rsiMax, 1, 100, DEFAULT_PARAMS.rsiMax),
        stopPct: num(p.stopPct, 0.1, 90, DEFAULT_PARAMS.stopPct),
        takePct: num(p.takePct, 0.1, 500, DEFAULT_PARAMS.takePct),
        sizePct: num(p.sizePct, 0.1, 100, DEFAULT_PARAMS.sizePct),
        startingCapital: num(p.startingCapital, 1000, 1e9, DEFAULT_PARAMS.startingCapital),
    };
}

/** EMA seeded from the SMA of the first `period` values; null until then. */
export function ema(values: number[], period: number): (number | null)[] {
    const out: (number | null)[] = new Array(values.length).fill(null);
    if (values.length < period || period < 1) return out;
    const k = 2 / (period + 1);
    let seed = 0;
    for (let i = 0; i < period; i++) seed += values[i];
    let prev = seed / period;
    out[period - 1] = prev;
    for (let i = period; i < values.length; i++) {
        prev = values[i] * k + prev * (1 - k);
        out[i] = prev;
    }
    return out;
}

/** Wilder RSI; null until `period` deltas exist. Never a neutral placeholder. */
export function rsi(values: number[], period: number): (number | null)[] {
    const out: (number | null)[] = new Array(values.length).fill(null);
    if (values.length <= period || period < 1) return out;
    let gain = 0;
    let loss = 0;
    for (let i = 1; i <= period; i++) {
        const d = values[i] - values[i - 1];
        gain += Math.max(0, d);
        loss += Math.max(0, -d);
    }
    gain /= period;
    loss /= period;
    out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    for (let i = period + 1; i < values.length; i++) {
        const d = values[i] - values[i - 1];
        gain = (gain * (period - 1) + Math.max(0, d)) / period;
        loss = (loss * (period - 1) + Math.max(0, -d)) / period;
        out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
    return out;
}

const BARS_PER_YEAR = (seconds: number) => (365 * 24 * 3600) / Math.max(1, seconds);

export function runBacktest(params: BacktestParams, candles: Candle[], barSeconds: number): BacktestResult {
    const p = sanitiseParams(params);
    const warnings: string[] = [];
    const feeBps = FEE_BPS_TAKER[marketOf(p.symbol)] ?? 2;
    const feeRate = feeBps / 10000;
    const slip = TAKER_SLIPPAGE_BPS / 10000;

    const closes = candles.map((c) => c.close);
    const emaFast = ema(closes, p.fast);
    const emaSlow = ema(closes, p.slow);
    const rsiArr = rsi(closes, p.rsiPeriod);

    let cash = p.startingCapital;
    let equityVal = cash;
    let inPos = false;
    let entryPrice = 0;
    let entryTime = 0;
    let qty = 0;

    const trades: BacktestTrade[] = [];
    const equity: number[] = [];
    const drawdown: number[] = [];
    let peak = cash;
    const monthEnd = new Map<string, number>();

    const buy = (price: number) => {
        const fill = price * (1 + slip);
        const alloc = equityVal * (p.sizePct / 100);
        qty = alloc / fill;
        if (!(qty > 0) || !Number.isFinite(qty)) { qty = 0; return false; }
        cash -= qty * fill + qty * fill * feeRate;
        entryPrice = fill;
        inPos = true;
        return true;
    };
    const sell = (price: number, time: number, reason: BacktestTrade['reason']) => {
        const fill = price * (1 - slip);
        cash += qty * fill - qty * fill * feeRate;
        const pnl = qty * (fill - entryPrice) - qty * fill * feeRate - qty * entryPrice * feeRate;
        trades.push({ entryTime, exitTime: time, entry: entryPrice, exit: fill, pnl, ret: (fill - entryPrice) / entryPrice, reason });
        inPos = false;
        qty = 0;
    };

    // Signals from bar i-1's close execute at bar i's open — no same-bar look-ahead.
    for (let i = 1; i < candles.length; i++) {
        const bar = candles[i];
        const s = i - 1; // signal bar

        if (inPos) {
            const stopPrice = entryPrice * (1 - p.stopPct / 100);
            const takePrice = entryPrice * (1 + p.takePct / 100);
            if (bar.open <= stopPrice) {
                sell(bar.open, bar.time, 'stop');          // gapped through the stop
            } else if (bar.open >= takePrice) {
                sell(bar.open, bar.time, 'target');
            } else if (bar.low <= stopPrice) {
                sell(stopPrice, bar.time, 'stop');         // stop resolves before target
            } else if (bar.high >= takePrice) {
                sell(takePrice, bar.time, 'target');
            }
        }

        const f0 = emaFast[s - 1];
        const f1 = emaFast[s];
        const sl0 = emaSlow[s - 1];
        const sl1 = emaSlow[s];
        const r = rsiArr[s];
        const ready = f0 != null && f1 != null && sl0 != null && sl1 != null;

        if (ready) {
            const crossUp = f0 <= sl0 && f1 > sl1;
            const crossDown = f0 >= sl0 && f1 < sl1;
            if (!inPos && crossUp && r != null && r < p.rsiMax) {
                buy(bar.open);
                entryTime = bar.time;
            } else if (inPos && crossDown) {
                sell(bar.open, bar.time, 'signal');
            }
        }

        equityVal = cash + (inPos ? qty * bar.close : 0);
        equity.push(equityVal);
        peak = Math.max(peak, equityVal);
        drawdown.push(peak > 0 ? (equityVal / peak - 1) * 100 : 0);

        const d = new Date(bar.time * 1000);
        monthEnd.set(`${d.getUTCFullYear()}-${d.getUTCMonth()}`, equityVal);
    }

    // Close anything still open, so trades reconcile with the equity curve.
    if (inPos && candles.length) {
        const last = candles[candles.length - 1];
        sell(last.close, last.time, 'forced');
        equityVal = cash;
        if (equity.length) equity[equity.length - 1] = equityVal;
        warnings.push('A position was open at the end of the series and was closed at the final price.');
    }

    const finalValue = equityVal;
    const netPct = p.startingCapital > 0 ? (finalValue / p.startingCapital - 1) * 100 : 0;
    const maxDD = drawdown.length ? drawdown.reduce((a, b) => Math.min(a, b), 0) : 0;
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);
    const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
    const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
    // null, not a magic 99, when there are no losing trades to divide by.
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : null;

    // Sharpe from per-BAR equity returns, annualised by the real bar interval.
    // The old version was mean/σ × √(trade count) — a t-statistic that grows without
    // bound as trades accumulate.
    let sharpe: number | null = null;
    if (equity.length > 2) {
        const rets: number[] = [];
        for (let i = 1; i < equity.length; i++) {
            if (equity[i - 1] > 0) rets.push(equity[i] / equity[i - 1] - 1);
        }
        if (rets.length > 2) {
            const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
            const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1); // sample
            const sd = Math.sqrt(variance);
            if (sd > 0) sharpe = (mean / sd) * Math.sqrt(BARS_PER_YEAR(barSeconds));
        }
    }

    if (trades.length < 5) warnings.push(`Only ${trades.length} trade${trades.length === 1 ? '' : 's'} — the statistics below are not meaningful.`);

    const metrics = [
        { label: 'NET RETURN', value: `${netPct >= 0 ? '+' : ''}${netPct.toFixed(1)}%`, col: netPct >= 0 ? 'var(--up)' : 'var(--down)', sub: `final ₹${Math.round(finalValue).toLocaleString('en-IN')}` },
        { label: 'WIN RATE', value: trades.length ? `${winRate.toFixed(0)}%` : '—', col: trades.length ? (winRate >= 50 ? 'var(--up)' : 'var(--down)') : undefined, sub: `${wins.length} / ${trades.length} trades` },
        { label: 'PROFIT FACTOR', value: profitFactor == null ? (grossWin > 0 ? '∞' : '—') : profitFactor.toFixed(2), sub: profitFactor == null ? 'no losing trades' : 'gross win / loss' },
        { label: 'MAX DRAWDOWN', value: `${maxDD.toFixed(1)}%`, col: 'var(--down)', sub: 'peak to trough' },
        { label: 'SHARPE', value: sharpe == null ? '—' : sharpe.toFixed(2), sub: sharpe == null ? 'not enough data' : 'annualised, per bar' },
        { label: 'TOTAL TRADES', value: String(trades.length), sub: `${candles.length} bars` },
    ];

    return {
        metrics,
        equity,
        drawdown,
        heatRows: buildHeat(monthEnd, p.startingCapital),
        finalValue,
        netPct,
        maxDD,
        trades: trades.length,
        sharpe,
        profitFactor,
        warnings,
    };
}

/**
 * Monthly returns from month-END equity snapshots.
 * The previous version skipped empty months without advancing `prev`, so the next
 * populated month reported a multi-month compounded return in a single cell; and the
 * year list was hardcoded [2022..2026], silently dropping the current year from 2027.
 */
export function buildHeat(monthEnd: Map<string, number>, startCapital: number): HeatRow[] {
    if (!monthEnd.size) return [];
    const keys = [...monthEnd.keys()].map((k) => {
        const [y, m] = k.split('-').map(Number);
        return { y, m, key: k };
    });
    const years = [...new Set(keys.map((k) => k.y))].sort((a, b) => a - b);

    let prev = startCapital;
    const rows: HeatRow[] = [];
    for (const y of years) {
        const cells = [];
        for (let m = 0; m < 12; m++) {
            const val = monthEnd.get(`${y}-${m}`);
            if (val == null) {
                cells.push({ label: '', bg: 'transparent', col: 'transparent' });
                continue;
            }
            const ret = prev > 0 ? (val / prev - 1) * 100 : 0;
            prev = val; // only advances on months that actually have data
            const a = Math.min(0.85, 0.14 + Math.abs(ret) / 16);
            const pos = ret >= 0;
            const bg = `rgba(${pos ? '47,212,126' : '255,84,112'},${a.toFixed(2)})`;
            cells.push({ label: `${pos ? '+' : '−'}${Math.abs(ret).toFixed(1)}`, bg, col: 'var(--text)' });
        }
        rows.push({ year: String(y), cells });
    }
    return rows;
}
