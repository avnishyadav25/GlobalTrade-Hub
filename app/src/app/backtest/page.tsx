'use client';

import { useEffect, useMemo, useState } from 'react';
import { AreaChart, DrawdownChart, Heatmap } from '@/components/charts';
import { runBacktest, DEFAULT_PARAMS, type BacktestResult } from '@/lib/backtestEngine';
import { WATCHLIST_ASSETS } from '@/lib/mockData';
import { TIMEFRAMES } from '@/lib/constants';
import { fmtMoney } from '@/lib/format';

export default function BacktestPage() {
    const [symbol, setSymbol] = useState('BTC/USDT');
    const [timeframe, setTimeframe] = useState('15m');
    const [fast, setFast] = useState(9);
    const [slow, setSlow] = useState(21);
    const [rsiMax, setRsiMax] = useState(70);
    const [stopPct, setStopPct] = useState(2);
    const [takePct, setTakePct] = useState(5);
    const [sizePct, setSizePct] = useState(10);
    const [seed, setSeed] = useState(4);
    const [result, setResult] = useState<BacktestResult | null>(null);

    const params = useMemo(
        () => ({ ...DEFAULT_PARAMS, symbol, timeframe, fast, slow, rsiMax, stopPct, takePct, sizePct, seed }),
        [symbol, timeframe, fast, slow, rsiMax, stopPct, takePct, sizePct, seed]
    );

    useEffect(() => {
        setResult(runBacktest(params));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const run = () => {
        const ns = seed + 1;
        setSeed(ns);
        setResult(runBacktest({ ...params, seed: ns }));
    };

    const entryRules = [`EMA(${fast}) crosses above EMA(${slow})`, `RSI(14) below ${rsiMax}`];
    const exitRules = [`EMA(${fast}) crosses below EMA(${slow})`, `Stop loss · ${stopPct}%`, `Take profit · ${takePct}%`];

    return (
        <div className="grid h-full min-h-0" style={{ gridTemplateColumns: '330px 1fr' }}>
            {/* builder */}
            <div className="overflow-auto border-r border-border bg-panel" style={{ padding: 18 }}>
                <div className="mb-4 flex items-center justify-between">
                    <span className="text-base font-extrabold">Strategy</span>
                    <div className="flex gap-1 rounded-lg bg-chip p-1 text-[11.5px] font-semibold">
                        <span className="rounded-md bg-panel px-2.5 py-1.5 text-foreground">Visual</span>
                        <span className="px-2.5 py-1.5 text-foreground-muted">Code</span>
                    </div>
                </div>

                <Label>NAME</Label>
                <Box>EMA Crossover + RSI filter</Box>

                <div className="grid grid-cols-2 gap-2.5">
                    <div>
                        <Label>MARKET / SYMBOL</Label>
                        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="mt-1.5 w-full rounded-[9px] border border-border bg-background px-3 py-2.5 text-[13px] outline-none">
                            {WATCHLIST_ASSETS.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
                        </select>
                    </div>
                    <div>
                        <Label>TIMEFRAME</Label>
                        <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="mt-1.5 w-full rounded-[9px] border border-border bg-background px-3 py-2.5 text-[13px] outline-none">
                            {TIMEFRAMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                </div>

                <Label className="mt-3.5 block">DATE RANGE</Label>
                <Box>Jan 2022 — {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</Box>

                <Label>STARTING CAPITAL</Label>
                <Box mono>{fmtMoney(DEFAULT_PARAMS.startingCapital, 'INR', 0)}</Box>

                <Divider color="var(--up)" text="ENTRY CONDITIONS" />
                {entryRules.map((c) => <Cond key={c} color="var(--up)" text={c} />)}

                <Divider color="var(--down)" text="EXIT CONDITIONS" />
                {exitRules.map((c) => <Cond key={c} color="var(--down)" text={c} />)}

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                    <Num label="EMA FAST" value={fast} set={setFast} />
                    <Num label="EMA SLOW" value={slow} set={setSlow} />
                    <Num label="RSI MAX" value={rsiMax} set={setRsiMax} />
                    <Num label="SIZE %" value={sizePct} set={setSizePct} />
                    <Num label="STOP %" value={stopPct} set={setStopPct} />
                    <Num label="TAKE %" value={takePct} set={setTakePct} />
                </div>

                <button onClick={run} className="mt-4 w-full rounded-[11px] py-3 text-sm font-extrabold" style={{ background: 'var(--accent)', color: 'var(--cp-text)', boxShadow: '0 6px 18px var(--accent-soft)' }}>
                    ▶ Run Backtest
                </button>
            </div>

            {/* results */}
            <div className="overflow-auto" style={{ background: 'var(--bg)', padding: '22px 26px' }}>
                <div className="mb-5 flex items-end justify-between">
                    <div>
                        <div className="text-xl font-extrabold">EMA Crossover + RSI filter</div>
                        <div className="mono text-[12.5px] text-foreground-muted">{symbol} · {timeframe} · Jan 2022 → now</div>
                    </div>
                    <span className="rounded-full px-2.5 py-1.5 text-[11px] font-bold text-up" style={{ background: 'rgba(47,212,126,.1)' }}>● Run complete</span>
                </div>

                {result && (
                    <>
                        <div className="mb-5 grid gap-3" style={{ gridTemplateColumns: 'repeat(6,1fr)' }}>
                            {result.metrics.map((m) => (
                                <div key={m.label} className="panel" style={{ padding: 15 }}>
                                    <div className="text-[10px] font-bold tracking-wide text-faint">{m.label}</div>
                                    <div className="mono my-2 text-[23px] font-extrabold" style={{ color: m.col }}>{m.value}</div>
                                    <div className="text-[11px] text-faint">{m.sub}</div>
                                </div>
                            ))}
                        </div>

                        <div className="panel mb-5" style={{ padding: 18 }}>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-extrabold">Equity curve</span>
                                <span className="mono text-[12px] text-foreground-muted">{fmtMoney(DEFAULT_PARAMS.startingCapital, 'INR', 0)} → {fmtMoney(result.finalValue, 'INR', 0)}</span>
                            </div>
                            <div style={{ height: 230, marginTop: 12 }}><AreaChart points={result.equity} id="bt-eq" /></div>
                        </div>

                        <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1.25fr' }}>
                            <div className="panel" style={{ padding: 18 }}>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-extrabold">Drawdown</span>
                                    <span className="mono text-[12px] font-bold text-down">{result.maxDD.toFixed(1)}%</span>
                                </div>
                                <div style={{ height: 120, marginTop: 12 }}><DrawdownChart points={result.drawdown} /></div>
                            </div>
                            <div className="panel" style={{ padding: 18 }}>
                                <div className="mb-3.5 text-sm font-extrabold">Monthly returns <span className="text-[11px] font-medium text-faint">%</span></div>
                                <Heatmap rows={result.heatRows} />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <label className={`text-[10.5px] font-bold tracking-wide text-faint ${className}`}>{children}</label>;
}
function Box({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
    return <div className={`my-1.5 flex items-center rounded-[9px] border border-border bg-background px-3 py-2.5 text-[13px] font-semibold ${mono ? 'mono' : ''}`}>{children}</div>;
}
function Divider({ color, text }: { color: string; text: string }) {
    return (
        <div className="mb-2 mt-4.5 flex items-center gap-2" style={{ marginTop: 18 }}>
            <span className="text-[11px] font-extrabold tracking-wide" style={{ color }}>{text}</span>
            <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
        </div>
    );
}
function Cond({ color, text }: { color: string; text: string }) {
    return (
        <div className="mb-2 flex items-center justify-between rounded-[9px] border border-border bg-background px-3 py-2.5 text-[12px]">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{text}</span>
        </div>
    );
}
function Num({ label, value, set }: { label: string; value: number; set: (n: number) => void }) {
    return (
        <div>
            <Label>{label}</Label>
            <input type="number" value={value} onChange={(e) => set(Number(e.target.value))} className="mono mt-1.5 w-full rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] outline-none" />
        </div>
    );
}
