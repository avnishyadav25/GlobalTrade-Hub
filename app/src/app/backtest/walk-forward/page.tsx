'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PageShell, Panel, Badge, Button, Callout, Field, Select, Input, DataTable, EmptyState, type Column } from '@/components/ui';
import { GridBuilder, defaultGrid } from '@/components/strategies/GridBuilder';
import { allStrategies } from '@/lib/strategies/defs';
import { MAX_COMBINATIONS, type ParamGrid, type FoldResult, type WalkForwardProgress, type WalkForwardResult } from '@/lib/strategies/walkForward';
import type { WalkForwardRequest, WalkForwardResponse } from '@/workers/walkForward.worker';
import { candlesUrl } from '@/lib/marketData/candlesUrl';
import { allInstruments } from '@/lib/instruments';
import { marketOf } from '@/lib/paperEngine';
import { useMarketStore } from '@/stores/marketStore';
import { TIMEFRAMES } from '@/lib/constants';
import { fmtPct } from '@/lib/format';

// Walk-forward: choose parameters on data you had, measure them on data you did not.
//
// This screen exists because a single backtest over a whole series answers a question
// nobody has — "if I had known the best parameters in advance, how would this have done?"
// You did not know them in advance. The gap between the two columns here IS the finding,
// and it is the only defence this app has against its own short history.
//
// The run happens in a worker. That is not a nicety: a default grid over four folds is
// well over a thousand full backtests, and inline it would freeze the tab before React
// ever painted a loading state.

const BROWSER_CAP = MAX_COMBINATIONS;

const FOLD_COLUMNS: Column<FoldResult>[] = [
    { key: 'fold', header: 'Fold', width: '60px', render: (f) => <span className="mono text-sm">{f.index + 1}</span> },
    {
        key: 'windows', header: 'Train → test', width: '1.2fr',
        render: (f) => (
            <span className="mono text-2xs text-faint">
                {f.trainFrom}–{f.trainTo} → {f.testFrom}–{f.testTo}
            </span>
        ),
    },
    {
        key: 'params', header: 'Chosen parameters', width: '1.6fr',
        render: (f) => (
            <span className="mono text-2xs text-faint">
                {Object.entries(f.bestParams).map(([k, v]) => `${k}=${v}`).join('  ') || 'defaults'}
            </span>
        ),
    },
    {
        key: 'is', header: 'In-sample', width: '110px', align: 'right',
        render: (f) => <span className="mono text-sm text-faint">{fmtPct(f.inSampleNetPct)}</span>,
    },
    {
        key: 'oos', header: 'Out-of-sample', width: '120px', align: 'right',
        render: (f) => (
            <span className="mono text-sm font-semibold" style={{ color: f.outOfSampleNetPct >= 0 ? 'var(--up)' : 'var(--down)' }}>
                {fmtPct(f.outOfSampleNetPct)}
            </span>
        ),
    },
    { key: 'tried', header: 'Tried', width: '70px', align: 'right', render: (f) => <span className="mono text-2xs text-faint">{f.combinationsTried}</span> },
];

export default function WalkForwardPage() {
    const instruments = useMemo(() => allInstruments(), []);
    // Pair and universe strategies consume a second series through ctx.other; searching
    // one as if it were single-instrument would silently drop that leg.
    const strategies = useMemo(() => allStrategies().filter((s) => !s.signalOnly && s.shape === 'single'), []);

    const [strategyId, setStrategyId] = useState(strategies[0]?.id ?? '');
    const [symbol, setSymbol] = useState(instruments[0]?.symbol ?? 'AAPL');
    const [timeframe, setTimeframe] = useState('1d');
    const [capital, setCapital] = useState(100_000);
    const [folds, setFolds] = useState(4);
    const [grid, setGrid] = useState<ParamGrid>({});

    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<WalkForwardProgress | null>(null);
    const [result, setResult] = useState<WalkForwardResult | null>(null);
    const [error, setError] = useState('');
    const [meta, setMeta] = useState<{ bars: number; source: string; synthetic: boolean } | null>(null);

    const workerRef = useRef<Worker | null>(null);
    const strategy = useMemo(() => strategies.find((s) => s.id === strategyId), [strategies, strategyId]);

    // Reset the grid whenever the strategy changes — a grid keyed to another strategy's
    // parameters would silently expand to a single no-op combination.
    useEffect(() => {
        if (strategy) setGrid(defaultGrid(strategy.params));
    }, [strategy]);

    useEffect(() => () => workerRef.current?.terminate(), []);

    const cancel = useCallback(() => {
        workerRef.current?.terminate();
        workerRef.current = null;
        setBusy(false);
        setProgress(null);
    }, []);

    const run = useCallback(async () => {
        if (!strategy) return;
        setBusy(true);
        setError('');
        setResult(null);
        setProgress(null);

        try {
            const price = useMarketStore.getState().quotes[symbol]?.price;
            const res = await fetch(candlesUrl(symbol, timeframe, 1000, price));
            if (!res.ok) throw new Error(`Could not load candles (${res.status}).`);
            const data = await res.json();
            const bars = data?.candles ?? [];
            if (!bars.length) throw new Error('No candles came back for this instrument.');
            setMeta({ bars: bars.length, source: data?.source ?? 'unknown', synthetic: !!data?.synthetic });

            workerRef.current?.terminate();
            const worker = new Worker(new URL('../../../workers/walkForward.worker.ts', import.meta.url), { type: 'module' });
            workerRef.current = worker;

            worker.onmessage = (event: MessageEvent<WalkForwardResponse>) => {
                const msg = event.data;
                if (msg.kind === 'progress') setProgress(msg.progress);
                else if (msg.kind === 'done') {
                    setResult(msg.result);
                    setBusy(false);
                    setProgress(null);
                    worker.terminate();
                    workerRef.current = null;
                } else {
                    setError(msg.message);
                    setBusy(false);
                    setProgress(null);
                    worker.terminate();
                    workerRef.current = null;
                }
            };
            worker.onerror = () => {
                setError('The walk-forward worker failed to start. Reload and try again.');
                setBusy(false);
                setProgress(null);
            };

            const request: WalkForwardRequest = {
                strategyId: strategy.id,
                symbol,
                market: marketOf(symbol),
                bars,
                barSeconds: TIMEFRAMES.find((t) => t.value === timeframe)?.seconds ?? 86_400,
                startingCapital: capital,
                grid,
                folds,
                maxCombinations: BROWSER_CAP,
            };
            worker.postMessage(request);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'The run failed.');
            setBusy(false);
        }
    }, [strategy, symbol, timeframe, capital, grid, folds]);

    const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;
    const ranNothing = result != null && result.folds.length === 0;

    return (
        <PageShell
            title="Walk-forward"
            subtitle="Choose parameters on data you had, then measure them on data you had not seen. The gap between the two is the finding — it is what separates a strategy that works from parameters that fit this series."
        >
            <Panel>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Strategy" hint="Single-instrument strategies only.">
                        <Select value={strategyId} onChange={(e) => setStrategyId(e.target.value)} disabled={busy}>
                            {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                    </Field>
                    <Field label="Instrument">
                        <Select value={symbol} onChange={(e) => setSymbol(e.target.value)} disabled={busy}>
                            {instruments.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
                        </Select>
                    </Field>
                    <Field label="Timeframe" hint="Daily gives about two years; intraday gives far less.">
                        <Select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} disabled={busy}>
                            {TIMEFRAMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </Select>
                    </Field>
                    <Field label="Folds" hint="More folds means shorter windows. Below three, stability says nothing.">
                        <Input type="number" min={1} max={10} value={folds} onChange={(e) => setFolds(Math.max(1, Number(e.target.value) || 4))} disabled={busy} />
                    </Field>
                    <Field label="Starting capital" hint="Brokerage is capped per order, so size genuinely changes which parameters win.">
                        <Input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value) || 0)} disabled={busy} />
                    </Field>
                </div>

                <div className="mt-4 border-t border-border2 pt-4">
                    <h2 className="mb-3 text-sm font-semibold">Search this grid</h2>
                    {strategy && (
                        <GridBuilder specs={strategy.params} grid={grid} onChange={setGrid} cap={BROWSER_CAP} disabled={busy} />
                    )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button variant="primary" onClick={run} disabled={busy || !strategy}>
                        {busy ? 'Running…' : 'Run walk-forward'}
                    </Button>
                    {busy && <Button variant="ghost" onClick={cancel}>Cancel</Button>}
                    {busy && progress && (
                        <span className="flex min-w-[220px] flex-1 items-center gap-2">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-chip">
                                <span className="block h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
                            </span>
                            <span className="mono text-2xs text-faint">
                                fold {progress.fold + 1}/{progress.folds} · {progress.done}/{progress.total}
                            </span>
                        </span>
                    )}
                </div>
                {busy && (
                    <p className="mt-2 text-2xs text-faint">
                        Running off the main thread, so the rest of the app stays usable. Cancelling stops it immediately.
                    </p>
                )}
            </Panel>

            {error && <Callout tone="down">{error}</Callout>}

            {meta?.synthetic && (
                <Callout tone="warn">
                    No provider covers this instrument at this timeframe, so the series is <strong>generated</strong>.
                    Walk-forward on generated data tests that the machinery runs. It is not evidence about a market.
                </Callout>
            )}

            {ranNothing && (
                <div className="mt-5">
                    <EmptyState
                        title="Not enough history to split"
                        body={result!.warnings.join(' ')}
                    />
                </div>
            )}

            {result && result.folds.length > 0 && (
                <>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-sm border border-border2 bg-panel2 p-3">
                            <div className="text-2xs font-bold tracking-wide text-faint">IN-SAMPLE</div>
                            <div className="mono mt-1 text-lg font-semibold text-faint">{fmtPct(result.inSampleNetPct)}</div>
                            <div className="mt-0.5 text-2xs text-faint">chosen on this data</div>
                        </div>
                        <div className="rounded-sm border border-border2 bg-panel2 p-3">
                            <div className="text-2xs font-bold tracking-wide text-faint">OUT-OF-SAMPLE</div>
                            <div
                                className="mono mt-1 text-lg font-semibold"
                                style={{ color: result.outOfSampleNetPct >= 0 ? 'var(--up)' : 'var(--down)' }}
                            >
                                {fmtPct(result.outOfSampleNetPct)}
                            </div>
                            <div className="mt-0.5 text-2xs text-faint">the number that counts</div>
                        </div>
                        <div className="rounded-sm border border-border2 bg-panel2 p-3">
                            <div className="text-2xs font-bold tracking-wide text-faint">DEGRADATION</div>
                            <div
                                className="mono mt-1 text-lg font-semibold"
                                style={{ color: result.degradation > 0 ? 'var(--down)' : 'var(--up)' }}
                            >
                                {result.degradation.toFixed(1)} pts
                            </div>
                            <div className="mt-0.5 text-2xs text-faint">the cost of fitting</div>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge tone={result.unstable ? 'down' : 'up'}>
                            {result.unstable ? 'parameters unstable across folds' : 'parameters stable across folds'}
                        </Badge>
                        <Badge>{result.folds.length} folds</Badge>
                        <Badge>{result.outOfSampleTrades.length} out-of-sample trades</Badge>
                        {meta && !meta.synthetic && <span className="text-xs text-faint">real data · {meta.source} · {meta.bars} bars</span>}
                    </div>

                    {result.warnings.map((w) => <Callout key={w} tone="warn">{w}</Callout>)}

                    <Panel title="Every fold" className="mt-5" padding="none">
                        <DataTable columns={FOLD_COLUMNS} rows={result.folds} getRowKey={(f) => String(f.index)} minWidth={860} />
                    </Panel>

                    <p className="mt-3 text-xs text-faint">
                        Read the out-of-sample column, and read whether the chosen parameters changed between folds.
                        A strategy that picks a different winner every window is fitting each window rather than
                        describing the market, however good the returns look.{' '}
                        <Link href="/learn/walk-forward" className="text-accent underline underline-offset-2">The lesson on this</Link>.
                    </p>
                </>
            )}

            {!result && !busy && !error && (
                <p className="mt-5 text-sm text-faint">
                    Pick a strategy and a grid, then run. Compare with{' '}
                    <Link href="/backtest" className="text-accent underline underline-offset-2">the single-window comparison</Link>{' '}
                    — if a strategy looks good there and degrades sharply here, the single-window result was the fit.
                </p>
            )}
        </PageShell>
    );
}
