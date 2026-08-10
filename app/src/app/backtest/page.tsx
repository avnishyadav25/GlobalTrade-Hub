'use client';

import { useCallback, useEffect, useState } from 'react';
import { AreaChart, DrawdownChart, Heatmap } from '@/components/charts';
import { runBacktest, DEFAULT_PARAMS, sanitiseParams, type BacktestResult } from '@/lib/backtestEngine';
import { WATCHLIST_ASSETS, type Candle } from '@/lib/mockData';
import { TIMEFRAMES } from '@/lib/constants';
import { fmtMoney } from '@/lib/format';

type RunState = 'idle' | 'loading' | 'done' | 'error';

interface CandleResponse {
    source: string;
    synthetic: boolean;
    seconds: number;
    candles: Candle[];
}

export default function BacktestPage() {
    const [symbol, setSymbol] = useState('BTC/USDT');
    const [timeframe, setTimeframe] = useState('15m');
    const [startingCapital, setStartingCapital] = useState(DEFAULT_PARAMS.startingCapital);
    const [fast, setFast] = useState(9);
    const [slow, setSlow] = useState(21);
    const [rsiMax, setRsiMax] = useState(70);
    const [stopPct, setStopPct] = useState(2);
    const [takePct, setTakePct] = useState(5);
    const [sizePct, setSizePct] = useState(10);
    const [result, setResult] = useState<BacktestResult | null>(null);
    const [runState, setRunState] = useState<RunState>('idle');
    const [error, setError] = useState('');
    const [source, setSource] = useState<{ source: string; synthetic: boolean; bars: number; range: string } | null>(null);
    /** True when inputs changed since the displayed run — the results below are stale. */
    const [dirty, setDirty] = useState(false);

    const run = useCallback(async () => {
        setRunState('loading');
        setError('');
        try {
            const res = await fetch(`/api/marketdata/candles?symbol=${encodeURIComponent(symbol)}&interval=${timeframe}&limit=1000`);
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `request failed (${res.status})`);
            const data: CandleResponse = await res.json();
            if (!data.candles?.length) throw new Error('no candles returned');

            const params = sanitiseParams({
                ...DEFAULT_PARAMS,
                symbol,
                timeframe,
                startingCapital,
                fast,
                slow,
                rsiMax,
                stopPct,
                takePct,
                sizePct,
                seed: 1,
            });
            setResult(runBacktest(params, data.candles, data.seconds));
            const first = new Date(data.candles[0].time * 1000);
            const last = new Date(data.candles[data.candles.length - 1].time * 1000);
            const f = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
            setSource({ source: data.source, synthetic: data.synthetic, bars: data.candles.length, range: `${f(first)} → ${f(last)}` });
            setRunState('done');
            setDirty(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'backtest failed');
            setRunState('error');
        }
    }, [symbol, timeframe, startingCapital, fast, slow, rsiMax, stopPct, takePct, sizePct]);

    useEffect(() => {
        run();
        // Run once on mount; afterwards the user drives it with the Run button.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const touched = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); };

    const entryRules = [`EMA(${fast}) crosses above EMA(${slow})`, `RSI(${DEFAULT_PARAMS.rsiPeriod}) below ${rsiMax}`];
    const exitRules = [`EMA(${fast}) crosses below EMA(${slow})`, `Stop loss · ${stopPct}%`, `Take profit · ${takePct}%`];

    return (
        <div className="grid h-full min-h-0 lg:grid-cols-[330px_1fr]">
            {/* builder */}
            <div className="overflow-auto border-b border-border bg-panel p-4 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center justify-between">
                    <span className="text-base font-bold">Strategy</span>
                    <span className="mono rounded-md bg-chip px-2.5 py-1.5 text-xs text-foreground-muted">EMA + RSI</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                    <div>
                        <Label>MARKET / SYMBOL</Label>
                        <select value={symbol} onChange={(e) => touched(setSymbol)(e.target.value)} className="mt-1.5 w-full rounded-sm border border-border bg-background px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]">
                            {WATCHLIST_ASSETS.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
                        </select>
                    </div>
                    <div>
                        <Label>TIMEFRAME</Label>
                        <select value={timeframe} onChange={(e) => touched(setTimeframe)(e.target.value)} className="mt-1.5 w-full rounded-sm border border-border bg-background px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]">
                            {TIMEFRAMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                </div>

                <Label className="mt-3.5 block">DATE RANGE</Label>
                <Box mono>{source ? source.range : '—'}</Box>

                <Label>STARTING CAPITAL</Label>
                <Num label="" value={startingCapital} set={touched(setStartingCapital)} step={10000} />

                <Divider color="var(--up)" text="ENTRY CONDITIONS" />
                {entryRules.map((c) => <Cond key={c} color="var(--up)" text={c} />)}

                <Divider color="var(--down)" text="EXIT CONDITIONS" />
                {exitRules.map((c) => <Cond key={c} color="var(--down)" text={c} />)}

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                    <Num label="EMA FAST" value={fast} set={touched(setFast)} />
                    <Num label="EMA SLOW" value={slow} set={touched(setSlow)} />
                    <Num label="RSI MAX" value={rsiMax} set={touched(setRsiMax)} />
                    <Num label="SIZE %" value={sizePct} set={touched(setSizePct)} />
                    <Num label="STOP %" value={stopPct} set={touched(setStopPct)} />
                    <Num label="TAKE %" value={takePct} set={touched(setTakePct)} />
                </div>

                <button
                    onClick={run}
                    disabled={runState === 'loading'}
                    className="mt-4 w-full rounded-sm bg-accent py-2.5 text-md font-semibold text-[color:var(--cp-text)] transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                    {runState === 'loading' ? 'Running…' : '▶ Run Backtest'}
                </button>
                {dirty && runState === 'done' && (
                    <div className="mt-2 text-center text-xs font-semibold" style={{ color: 'var(--warn)' }}>
                        Parameters changed — results below are from the previous run.
                    </div>
                )}
            </div>

            {/* results */}
            <div className="overflow-auto bg-background px-4 py-5 sm:px-6">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="text-xl font-bold">EMA Crossover + RSI filter</div>
                        <div className="mono text-sm text-foreground-muted">
                            {symbol} · {timeframe}{source ? ` · ${source.range} · ${source.bars} bars` : ''}
                        </div>
                    </div>
                    {runState === 'done' && (
                        <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                source?.synthetic ? 'bg-warn-dim text-warn' : 'bg-up-dim text-up'
                            }`}
                        >
                            ● {source?.synthetic ? 'Synthetic data' : `Real data · ${source?.source}`}
                        </span>
                    )}
                </div>

                {/* An honest label beats a plausible-looking number. */}
                {runState === 'done' && source?.synthetic && (
                    <div className="mb-5 rounded-sm bg-warn-dim px-4 py-3 text-sm text-warn">
                        <strong>This is not a historical backtest.</strong> No price provider covers {symbol} at this
                        timeframe, so the run used a generated random-walk series. Treat the metrics as a smoke test of the
                        strategy logic, not evidence of an edge.
                    </div>
                )}

                {runState === 'loading' && (
                    <div className="panel flex items-center justify-center py-20 text-base text-faint">Fetching candles…</div>
                )}

                {runState === 'error' && (
                    <div className="panel px-5 py-6 text-base">
                        <div className="mb-1 font-bold text-down">Backtest failed</div>
                        <div className="text-foreground-muted">{error}</div>
                    </div>
                )}

                {runState === 'done' && result && (
                    <>
                        {result.warnings.length > 0 && (
                            <div className="mb-5 flex flex-col gap-1 rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--chip)', color: 'var(--foreground-muted)' }}>
                                {result.warnings.map((w) => <span key={w}>· {w}</span>)}
                            </div>
                        )}

                        <div className="mb-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                            {result.metrics.map((m) => (
                                <div key={m.label} className="panel p-4">
                                    <div className="text-2xs font-bold tracking-wide text-faint">{m.label}</div>
                                    <div className="mono my-2 text-xl font-bold" style={{ color: m.col }}>{m.value}</div>
                                    <div className="text-xs text-faint">{m.sub}</div>
                                </div>
                            ))}
                        </div>

                        <div className="panel mb-5 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold">Equity curve</span>
                                <span className="mono text-sm text-foreground-muted">{fmtMoney(startingCapital, 'INR', 0)} → {fmtMoney(result.finalValue, 'INR', 0)}</span>
                            </div>
                            <div className="mt-3" style={{ height: 230 }}>
                                {result.equity.length > 1
                                    ? <AreaChart points={result.equity} id="bt-eq" />
                                    : <div className="flex h-full items-center justify-center text-sm text-faint">Not enough bars to plot.</div>}
                            </div>
                        </div>

                        <div className="grid gap-5 xl:grid-cols-[1fr_1.25fr]">
                            <div className="panel p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold">Drawdown</span>
                                    <span className="mono text-sm font-bold text-down">{result.maxDD.toFixed(1)}%</span>
                                </div>
                                <div className="mt-3" style={{ height: 120 }}><DrawdownChart points={result.drawdown} /></div>
                            </div>
                            <div className="panel p-4">
                                <div className="mb-3.5 text-sm font-bold">Monthly returns <span className="text-xs font-medium text-faint">%</span></div>
                                {result.heatRows.length
                                    ? <Heatmap rows={result.heatRows} />
                                    : <div className="py-6 text-center text-sm text-faint">The series does not span a full month.</div>}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <label className={`text-2xs font-bold tracking-wide text-faint ${className}`}>{children}</label>;
}
function Box({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
    return <div className={`my-1.5 flex items-center rounded-sm border border-border bg-background px-3 py-2.5 text-base font-semibold ${mono ? 'mono' : ''}`}>{children}</div>;
}
function Divider({ color, text }: { color: string; text: string }) {
    return (
        <div className="mb-2 mt-5 flex items-center gap-2">
            <span className="text-xs font-bold tracking-wide" style={{ color }}>{text}</span>
            <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
        </div>
    );
}
function Cond({ color, text }: { color: string; text: string }) {
    return (
        <div className="mb-2 flex items-center justify-between rounded-sm border border-border bg-background px-3 py-2.5 text-sm">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{text}</span>
        </div>
    );
}
function Num({ label, value, set, step }: { label: string; value: number; set: (n: number) => void; step?: number }) {
    return (
        <div>
            {label && <Label>{label}</Label>}
            <input
                type="number"
                step={step}
                value={value}
                onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) set(n);
                }}
                className="mono mt-1.5 w-full rounded-sm border border-border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            />
        </div>
    );
}
