// Simple, transparent backtesting engine: EMA-crossover + RSI filter with
// stop/target and % position sizing, run over a synthetic OHLC history.
// Produces the metrics, equity curve, drawdown and monthly-returns heatmap the
// Backtest screen renders. Deterministic given (symbol, seed, params).

import { getAsset, type Candle } from './mockData';
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

function ema(values: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const out: number[] = [];
    let prev = values[0];
    for (let i = 0; i < values.length; i++) {
        prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
        out.push(prev);
    }
    return out;
}

function rsi(values: number[], period: number): number[] {
    const out: number[] = new Array(values.length).fill(50);
    let gain = 0, loss = 0;
    for (let i = 1; i < values.length; i++) {
        const d = values[i] - values[i - 1];
        const g = Math.max(0, d), l = Math.max(0, -d);
        if (i <= period) {
            gain += g; loss += l;
            if (i === period) {
                gain /= period; loss /= period;
                out[i] = 100 - 100 / (1 + gain / (loss || 1e-9));
            }
        } else {
            gain = (gain * (period - 1) + g) / period;
            loss = (loss * (period - 1) + l) / period;
            out[i] = 100 - 100 / (1 + gain / (loss || 1e-9));
        }
    }
    return out;
}

// Long history spanning ~Jan 2022 → now so the monthly heatmap has real buckets.
function history(symbol: string, seed: number): Candle[] {
    const base = getAsset(symbol)?.price ?? 100;
    let s = seed * 2654435761 % 233280 || 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    const start = Date.UTC(2022, 0, 1) / 1000;
    const now = Math.floor(Date.now() / 1000);
    const n = 1300;
    const step = Math.floor((now - start) / n);
    const vol = base * 0.02;
    let price = base * 0.4;
    const out: Candle[] = [];
    for (let i = 0; i < n; i++) {
        const drift = 0.0008; // gentle uptrend
        const open = price;
        price = Math.max(base * 0.15, price * (1 + drift) + (rnd() - 0.5) * vol);
        const close = price;
        out.push({
            time: start + i * step,
            open, close,
            high: Math.max(open, close) + rnd() * vol * 0.5,
            low: Math.min(open, close) - rnd() * vol * 0.5,
        });
    }
    return out;
}

export function runBacktest(params: BacktestParams): BacktestResult {
    const candles = history(params.symbol, params.seed);
    const closes = candles.map((c) => c.close);
    const emaFast = ema(closes, params.fast);
    const emaSlow = ema(closes, params.slow);
    const rsiArr = rsi(closes, params.rsiPeriod);

    let cash = params.startingCapital;
    let equityVal = cash;
    let inPos = false;
    let entryPrice = 0, entryTime = 0, qty = 0;
    const trades: BacktestTrade[] = [];
    const equity: number[] = [];
    let peak = cash;
    const drawdown: number[] = [];
    // monthly equity snapshots
    const monthly: Record<string, number> = {};

    for (let i = 1; i < candles.length; i++) {
        const price = closes[i];
        const crossUp = emaFast[i - 1] <= emaSlow[i - 1] && emaFast[i] > emaSlow[i];
        const crossDown = emaFast[i - 1] >= emaSlow[i - 1] && emaFast[i] < emaSlow[i];

        if (!inPos && crossUp && rsiArr[i] < params.rsiMax) {
            const alloc = equityVal * (params.sizePct / 100);
            qty = alloc / price;
            entryPrice = price;
            entryTime = candles[i].time;
            cash -= qty * price;
            inPos = true;
        } else if (inPos) {
            const ret = (price - entryPrice) / entryPrice;
            const hitStop = ret <= -params.stopPct / 100;
            const hitTake = ret >= params.takePct / 100;
            if (crossDown || hitStop || hitTake) {
                cash += qty * price;
                const pnl = qty * (price - entryPrice);
                trades.push({ entryTime, exitTime: candles[i].time, entry: entryPrice, exit: price, pnl, ret });
                inPos = false;
                qty = 0;
            }
        }

        equityVal = cash + (inPos ? qty * price : 0);
        equity.push(equityVal);
        peak = Math.max(peak, equityVal);
        drawdown.push((equityVal / peak - 1) * 100);

        const d = new Date(candles[i].time * 1000);
        monthly[`${d.getUTCFullYear()}-${d.getUTCMonth()}`] = equityVal;
    }

    const finalValue = equityVal;
    const netPct = (finalValue / params.startingCapital - 1) * 100;
    const maxDD = Math.min(0, ...drawdown);
    const wins = trades.filter((t) => t.pnl > 0);
    const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
    const grossLoss = Math.abs(trades.filter((t) => t.pnl < 0).reduce((a, t) => a + t.pnl, 0));
    const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
    const profitFactor = grossLoss ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;

    // Sharpe from per-trade returns
    const rets = trades.map((t) => t.ret);
    const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1);
    const sharpe = variance ? (mean / Math.sqrt(variance)) * Math.sqrt(rets.length || 1) : 0;

    const metrics = [
        { label: 'NET RETURN', value: `${netPct >= 0 ? '+' : ''}${netPct.toFixed(1)}%`, col: netPct >= 0 ? 'var(--up)' : 'var(--down)', sub: `final ₹${Math.round(finalValue).toLocaleString('en-IN')}` },
        { label: 'WIN RATE', value: `${winRate.toFixed(0)}%`, sub: `${wins.length} / ${trades.length} trades` },
        { label: 'PROFIT FACTOR', value: profitFactor.toFixed(2), sub: 'gross win / loss' },
        { label: 'MAX DRAWDOWN', value: `${maxDD.toFixed(1)}%`, col: 'var(--down)', sub: 'peak to trough' },
        { label: 'SHARPE', value: sharpe.toFixed(2), sub: 'risk-adjusted' },
        { label: 'TOTAL TRADES', value: String(trades.length), sub: 'over ~4.5 yrs' },
    ];

    return { metrics, equity, drawdown, heatRows: buildHeat(monthly, params.startingCapital), finalValue, netPct, maxDD, trades: trades.length };
}

function buildHeat(monthly: Record<string, number>, startCapital: number): HeatRow[] {
    const years = [2022, 2023, 2024, 2025, 2026];
    let prev = startCapital;
    const rows: HeatRow[] = [];
    for (const y of years) {
        const cells = [];
        for (let m = 0; m < 12; m++) {
            const key = `${y}-${m}`;
            const val = monthly[key];
            if (val == null) {
                cells.push({ label: '', bg: 'transparent', col: 'transparent' });
                continue;
            }
            const ret = (val / prev - 1) * 100;
            prev = val;
            const a = Math.min(0.85, 0.14 + Math.abs(ret) / 16);
            const pos = ret >= 0;
            const bg = `rgba(${pos ? '47,212,126' : '255,84,112'},${a.toFixed(2)})`;
            cells.push({ label: `${pos ? '+' : '−'}${Math.abs(ret).toFixed(1)}`, bg, col: 'var(--text)' });
        }
        rows.push({ year: String(y), cells });
    }
    return rows;
}
