'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageShell, Panel, Button, Callout, Field, Select, Input, DataTable, type Column } from '@/components/ui';
import { MultiLine, CorrelationMatrix, DrawdownChart } from '@/components/charts';
import { allStrategies } from '@/lib/strategies/defs';
import { runPortfolioBacktest, alignTo, type PortfolioLeg, type PortfolioResult, type LegResult } from '@/lib/strategies/portfolio';
import { candlesUrl } from '@/lib/marketData/candlesUrl';
import { allInstruments } from '@/lib/instruments';
import { marketOf } from '@/lib/paperEngine';
import { useMarketStore } from '@/stores/marketStore';
import { TIMEFRAMES } from '@/lib/constants';
import { fmtPct, fmtMoney } from '@/lib/format';
import type { Candle } from '@/lib/mockData';

// Portfolio backtesting: the same strategy across several instruments, with allocated
// capital and a COMBINED equity curve.
//
// The reason this cannot be done by running the single-instrument screen N times and
// adding up the returns: portfolio drawdown is not the average of the sleeve drawdowns,
// because the sleeves trough at different times. The gap between the two IS the
// diversification, and it only exists once the curves are summed on a shared timeline.

const LEG_COLUMNS: Column<LegResult>[] = [
    { key: 'symbol', header: 'Instrument', width: '1.2fr', render: (l) => <span className="text-sm font-semibold">{l.symbol}</span> },
    { key: 'alloc', header: 'Allocated', width: '120px', align: 'right', render: (l) => <span className="mono text-sm text-faint">{fmtMoney(l.allocation, 'INR', 0)}</span> },
    {
        key: 'ret', header: 'Return', width: '100px', align: 'right',
        render: (l) => (
            <span className="mono text-sm" style={{ color: l.result.metrics.netPct >= 0 ? 'var(--up)' : 'var(--down)' }}>
                {fmtPct(l.result.metrics.netPct)}
            </span>
        ),
    },
    {
        key: 'pnl', header: 'Contribution', width: '120px', align: 'right',
        render: (l) => (
            <span className="mono text-sm" style={{ color: l.pnl >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtMoney(l.pnl, 'INR', 0)}</span>
        ),
    },
    { key: 'dd', header: 'Max DD', width: '100px', align: 'right', render: (l) => <span className="mono text-sm text-down">{fmtPct(l.result.metrics.maxDD)}</span> },
    { key: 'trades', header: 'Trades', width: '80px', align: 'right', render: (l) => <span className="mono text-sm">{l.result.metrics.trades}</span> },
];

export default function PortfolioBacktestPage() {
    const instruments = useMemo(() => allInstruments(), []);
    // runPortfolioBacktest THROWS on a pair or universe strategy — it consumes a second
    // series itself and cannot be run as independent sleeves.
    const strategies = useMemo(() => allStrategies().filter((s) => !s.signalOnly && s.shape === 'single'), []);

    const [strategyId, setStrategyId] = useState(strategies[0]?.id ?? '');
    const [symbols, setSymbols] = useState<string[]>(() => instruments.slice(0, 3).map((a) => a.symbol));
    const [timeframe, setTimeframe] = useState('1d');
    const [capital, setCapital] = useState(400_000);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<PortfolioResult | null>(null);
    const [legBars, setLegBars] = useState<Record<string, Candle[]>>({});
    const [synthetic, setSynthetic] = useState<string[]>([]);

    const strategy = useMemo(() => strategies.find((s) => s.id === strategyId), [strategies, strategyId]);

    const toggle = (symbol: string) =>
        setSymbols((prev) => (prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]));

    const run = useCallback(async () => {
        if (!strategy || symbols.length === 0) return;
        setBusy(true);
        setError('');
        setResult(null);
        setSynthetic([]);

        try {
            const quotes = useMarketStore.getState().quotes;
            const generated: string[] = [];
            const bars: Record<string, Candle[]> = {};

            const legs: PortfolioLeg[] = [];
            for (const symbol of symbols) {
                const res = await fetch(candlesUrl(symbol, timeframe, 1000, quotes[symbol]?.price));
                if (!res.ok) throw new Error(`Could not load candles for ${symbol} (${res.status}).`);
                const data = await res.json();
                const candles = data?.candles ?? [];
                if (!candles.length) throw new Error(`No candles came back for ${symbol}.`);
                if (data?.synthetic) generated.push(symbol);
                bars[symbol] = candles;
                legs.push({ symbol, market: marketOf(symbol), bars: candles });
            }

            const barSeconds = TIMEFRAMES.find((t) => t.value === timeframe)?.seconds ?? 86_400;
            setLegBars(bars);
            setSynthetic(generated);
            setResult(runPortfolioBacktest({ strategy, legs, barSeconds, startingCapital: capital }));
        } catch (e) {
            // allocate() and runPortfolioBacktest both throw on bad input — an empty
            // portfolio, weights over 1, or a pair strategy. Surface the message.
            setError(e instanceof Error ? e.message : 'The portfolio run failed.');
        } finally {
            setBusy(false);
        }
    }, [strategy, symbols, timeframe, capital]);

    // PortfolioResult carries benchmarkPct but no benchmark CURVE, so build one by
    // aligning each sleeve's own buy-and-hold onto the shared timeline.
    const benchmarkCurve = useMemo(() => {
        if (!result) return [];
        const aligned = result.legs.map((leg) =>
            alignTo(result.timeline, legBars[leg.symbol] ?? [], leg.result.benchmark, leg.allocation)
        );
        return result.timeline.map((_, t) => aligned.reduce((sum, curve) => sum + (curve[t] ?? 0), 0));
    }, [result, legBars]);

    const idle = useMemo(
        () => (result ? result.legs.map((l, i) => (l.result.metrics.trades === 0 ? i : -1)).filter((i) => i >= 0) : []),
        [result]
    );

    const diversification = result ? result.weightedLegMaxDD - result.metrics.maxDD : 0;

    return (
        <PageShell
            title="Portfolio test"
            subtitle="One strategy across several instruments, with allocated capital and a combined equity curve. Running the single-instrument screen N times cannot tell you this — portfolio drawdown is not the average of the sleeve drawdowns."
        >
            <Panel>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Strategy" hint="Single-instrument strategies only.">
                        <Select value={strategyId} onChange={(e) => setStrategyId(e.target.value)} disabled={busy}>
                            {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                    </Field>
                    <Field label="Timeframe">
                        <Select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} disabled={busy}>
                            {TIMEFRAMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </Select>
                    </Field>
                    <Field label="Total capital" hint="Split equally across the instruments you pick.">
                        <Input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value) || 0)} disabled={busy} />
                    </Field>
                </div>

                <div className="mt-4 border-t border-border2 pt-4">
                    <h2 className="mb-2 text-sm font-semibold">
                        Instruments <span className="font-normal text-faint">— {symbols.length} selected, {fmtMoney(symbols.length ? capital / symbols.length : 0, 'INR', 0)} each</span>
                    </h2>
                    <div className="flex flex-wrap gap-1.5">
                        {instruments.map((a) => (
                            <button
                                key={a.symbol}
                                onClick={() => toggle(a.symbol)}
                                disabled={busy}
                                className={`rounded-sm border px-2.5 py-1 text-2xs font-semibold transition-colors ${
                                    symbols.includes(a.symbol) ? 'border-accent text-accent' : 'border-border text-foreground-muted hover:border-accent'
                                }`}
                            >
                                {a.symbol}
                            </button>
                        ))}
                    </div>
                </div>

                <Button variant="primary" className="mt-4" onClick={run} loading={busy} disabled={!symbols.length}>
                    Run portfolio
                </Button>
            </Panel>

            {error && <Callout tone="down">{error}</Callout>}

            {synthetic.length > 0 && (
                <Callout tone="warn">
                    No provider covers {synthetic.join(', ')} at this timeframe, so {synthetic.length === 1 ? 'that series is' : 'those series are'}{' '}
                    <strong>generated</strong>. A correlation computed against generated data measures the generator.
                </Callout>
            )}

            {result && (
                <>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-sm border border-border2 bg-panel2 p-3">
                            <div className="text-2xs font-bold tracking-wide text-faint">PORTFOLIO RETURN</div>
                            <div className="mono mt-1 text-lg font-semibold" style={{ color: result.metrics.netPct >= 0 ? 'var(--up)' : 'var(--down)' }}>
                                {fmtPct(result.metrics.netPct)}
                            </div>
                            <div className="mt-0.5 text-2xs text-faint">buy &amp; hold {fmtPct(result.metrics.benchmarkPct)}</div>
                        </div>
                        <div className="rounded-sm border border-border2 bg-panel2 p-3">
                            <div className="text-2xs font-bold tracking-wide text-faint">PORTFOLIO DRAWDOWN</div>
                            <div className="mono mt-1 text-lg font-semibold text-down">{fmtPct(result.metrics.maxDD)}</div>
                            <div className="mt-0.5 text-2xs text-faint">from the combined curve</div>
                        </div>
                        <div className="rounded-sm border border-border2 bg-panel2 p-3">
                            <div className="text-2xs font-bold tracking-wide text-faint">AVERAGE SLEEVE DD</div>
                            <div className="mono mt-1 text-lg font-semibold text-faint">{fmtPct(result.weightedLegMaxDD)}</div>
                            <div className="mt-0.5 text-2xs text-faint">weighted by allocation</div>
                        </div>
                        <div className="rounded-sm border border-border2 bg-panel2 p-3">
                            <div className="text-2xs font-bold tracking-wide text-faint">DIVERSIFICATION</div>
                            <div className="mono mt-1 text-lg font-semibold" style={{ color: diversification > 0.01 ? 'var(--up)' : 'var(--faint)' }}>
                                {diversification > 0.01 ? `${diversification.toFixed(1)} pts` : 'none'}
                            </div>
                            <div className="mt-0.5 text-2xs text-faint">
                                {diversification > 0.01 ? 'shallower than the sleeves' : 'the sleeves fell together'}
                            </div>
                        </div>
                    </div>

                    <p className="mt-3 text-xs text-faint">
                        The gap between the two drawdown figures <strong>is</strong> the diversification, measured rather
                        than assumed. When it is near zero, holding several instruments bought you nothing — they are
                        one position with several sets of costs.
                    </p>

                    {result.warnings.map((w) => <Callout key={w} tone="warn">{w}</Callout>)}

                    <Panel title="Portfolio equity" className="mt-5">
                        <MultiLine
                            label="Portfolio equity against holding the same basket"
                            series={[
                                { points: benchmarkCurve, label: 'hold the basket', color: 'var(--faint)', dashed: true },
                                { points: result.equity, label: 'strategy', color: 'var(--accent)' },
                            ]}
                        />
                    </Panel>

                    <Panel title="Portfolio drawdown" className="mt-5">
                        <DrawdownChart points={result.drawdown} />
                    </Panel>

                    <Panel title="Correlation between sleeves" className="mt-5">
                        <CorrelationMatrix
                            labels={result.legs.map((l) => l.symbol)}
                            values={result.correlation}
                            idle={idle}
                        />
                        <p className="mt-3 text-xs text-faint">
                            Red is positively correlated — those two moved together and diversified nothing. A dash means
                            that sleeve never traded, so it has no variance: that is not a measured zero, and reading it
                            as one would overstate your diversification.
                        </p>
                    </Panel>

                    <Panel title="Every sleeve" className="mt-5" padding="none">
                        <DataTable columns={LEG_COLUMNS} rows={result.legs} getRowKey={(l) => l.symbol} minWidth={720} />
                    </Panel>

                    <p className="mt-3 text-xs text-faint">
                        Capital is split into fixed sleeves and <strong>sleeves do not lend to each other</strong> — an
                        instrument sitting in cash does not fund a larger position elsewhere. That is a real allocation
                        policy, and it is not a shared cash pool where instruments compete for capital, which this engine
                        does not model.{' '}
                        <Link href="/learn/correlation-and-concentration" className="text-accent underline underline-offset-2">
                            The lesson on this
                        </Link>.
                    </p>
                </>
            )}

            {!result && !busy && !error && (
                <p className="mt-5 text-sm text-faint">
                    Pick a strategy and two or more instruments. Then compare the portfolio drawdown with the average
                    sleeve drawdown — if they match, you are not diversified, however many instruments you hold.
                </p>
            )}
        </PageShell>
    );
}
