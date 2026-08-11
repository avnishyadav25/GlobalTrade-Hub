'use client';

import { useMemo } from 'react';
import { Panel, Badge, Callout, DataTable, type Column } from '@/components/ui';
import { DrawdownChart, MultiLine } from '@/components/charts';
import { fmtMoney, fmtPct } from '@/lib/format';
import type { StrategyBacktestResult, Trade } from '@/lib/strategies/backtest';

/**
 * Backtest results.
 *
 * Two things here are deliberate and were absent from the old screen: every run is shown
 * against buy-and-hold, and any statistic the sample cannot support is WITHHELD rather
 * than printed. A Sharpe ratio computed from nine trades is not a weak number, it is a
 * meaningless one, and showing it greyed out would still invite reading it.
 */

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' }) {
    return (
        <div className="rounded-sm border border-border2 bg-panel2 p-3">
            <div className="text-2xs font-bold tracking-wide text-faint">{label}</div>
            <div
                className="mono mt-1 text-lg font-semibold"
                style={{ color: tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--down)' : undefined }}
            >
                {value}
            </div>
            {sub && <div className="mt-0.5 text-2xs text-faint">{sub}</div>}
        </div>
    );
}

/** Equity against buy-and-hold on shared axes — the comparison that gives a result meaning. */
function EquityVsBenchmark({ equity, benchmark }: { equity: number[]; benchmark: number[] }) {
    const series = useMemo(
        () => [
            { points: benchmark, label: 'buy & hold', color: 'var(--faint)', dashed: true },
            { points: equity, label: 'strategy', color: 'var(--accent)' },
        ],
        [equity, benchmark]
    );
    return <MultiLine series={series} label="Strategy equity compared with buy and hold" />;
}

const TRADE_COLUMNS: Column<Trade>[] = [
    { key: 'side', header: 'Side', width: '70px', render: (t) => <Badge tone={t.side === 'long' ? 'up' : 'down'}>{t.side}</Badge> },
    { key: 'entry', header: 'Entry', width: '1fr', align: 'right', render: (t) => <span className="mono text-xs">{t.entryPrice.toFixed(2)}</span> },
    { key: 'exit', header: 'Exit', width: '1fr', align: 'right', render: (t) => <span className="mono text-xs">{t.exitPrice.toFixed(2)}</span> },
    { key: 'ret', header: 'Return', width: '90px', align: 'right', render: (t) => (
        <span className="mono text-xs" style={{ color: t.ret >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtPct(t.ret * 100)}</span>
    ) },
    { key: 'pnl', header: 'P&L', width: '110px', align: 'right', render: (t) => (
        <span className="mono text-xs" style={{ color: t.pnl >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtMoney(t.pnl, 'INR', 0)}</span>
    ) },
    { key: 'r', header: 'R', width: '70px', align: 'right', render: (t) => (
        <span className="mono text-xs text-faint">{t.rMultiple == null ? '—' : t.rMultiple.toFixed(2)}</span>
    ) },
    { key: 'why', header: 'Closed because', width: '1.4fr', render: (t) => <span className="text-xs text-faint">{t.exitReason}</span> },
];

export function StrategyResults({ result }: { result: StrategyBacktestResult }) {
    const m = result.metrics;
    const beatsBenchmark = m.netPct > m.benchmarkPct;

    return (
        <>
            {result.warnings.map((w) => (
                <Callout key={w} tone="warn">{w}</Callout>
            ))}

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                    label="NET RETURN"
                    value={fmtPct(m.netPct)}
                    tone={m.netPct >= 0 ? 'up' : 'down'}
                    sub={`final ${fmtMoney(result.finalValue, 'INR', 0)}`}
                />
                <Metric
                    label="BUY & HOLD"
                    value={fmtPct(m.benchmarkPct)}
                    sub={beatsBenchmark ? 'the strategy beat it' : 'the strategy did NOT beat it'}
                    tone={beatsBenchmark ? 'up' : 'down'}
                />
                <Metric label="MAX DRAWDOWN" value={fmtPct(m.maxDD)} tone="down" sub={`${m.maxDDBars} bars underwater`} />
                <Metric label="TRADES" value={String(m.trades)} sub={`over ${m.bars} bars`} />

                <Metric
                    label="WIN RATE"
                    value={m.winRate == null ? '—' : `${m.winRate.toFixed(0)}%`}
                    sub={m.winRate == null ? 'sample too small' : `payoff ${m.payoff?.toFixed(2) ?? '—'}`}
                />
                <Metric
                    label="SHARPE"
                    value={m.sharpe == null ? '—' : m.sharpe.toFixed(2)}
                    sub={m.sharpe == null ? 'sample too small' : `sortino ${m.sortino?.toFixed(2) ?? '—'}`}
                />
                <Metric
                    label="EXPECTANCY"
                    value={m.expectancy == null ? '—' : fmtMoney(m.expectancy, 'INR', 0)}
                    sub={m.expectancy == null ? 'sample too small' : 'per trade, after costs'}
                />
                <Metric
                    label="EXPOSURE"
                    value={`${(m.exposure * 100).toFixed(0)}%`}
                    sub={`turnover ${m.turnover.toFixed(1)}x · ${m.maxConsecutiveLosses} losses in a row`}
                />
            </div>

            {result.suppressed.length > 0 && (
                <p className="mt-3 text-xs text-faint">
                    Withheld because the sample cannot support them: {result.suppressed.join(', ')}. They are not
                    weak numbers at this sample size — they are meaningless ones.
                </p>
            )}

            <Panel title="Equity" className="mt-5">
                <EquityVsBenchmark equity={result.equity} benchmark={result.benchmark} />
            </Panel>

            <Panel title="Drawdown" className="mt-5">
                <DrawdownChart points={result.drawdown} />
            </Panel>

            <Panel title={`Every trade (${result.trades.length})`} className="mt-5" padding="none">
                {result.trades.length === 0 ? (
                    <p className="p-4 text-sm text-faint">
                        This strategy took no trades over the period. That is a result, not an error — most
                        strategies are inactive most of the time.
                    </p>
                ) : (
                    <DataTable columns={TRADE_COLUMNS} rows={result.trades} getRowKey={(t) => `${t.entryIndex}-${t.exitIndex}-${t.side}`} minWidth={720} />
                )}
            </Panel>
        </>
    );
}
