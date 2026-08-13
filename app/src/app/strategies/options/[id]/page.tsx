'use client';

import { use, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell, Panel, Badge, Button, Callout, Field, Select, Input, DataTable, type Column } from '@/components/ui';
import { MultiLine, DrawdownChart } from '@/components/charts';
import { ParamForm } from '@/components/strategies/ParamForm';
import { optionsStrategyById, type LegSpec } from '@/lib/options/strategy';
import { runOptionsBacktest, syntheticChainSeries, type OptionsBacktestResult, type OptionsTrade } from '@/lib/options/backtest';
import { defaultParams, type Params } from '@/lib/strategies/types';
import { candlesUrl } from '@/lib/marketData/candlesUrl';
import { useMarketStore } from '@/stores/marketStore';
import { fmtMoney, fmtPct } from '@/lib/format';

// An options structure, and the only screen that can run one.
//
// Separate from /strategies/[id] because an OptionsStrategy is a different contract: no
// `markets`, no `shape`, no `onBar`, and a position made of several strikes rather than
// one signed quantity. Sharing the equity detail page would have meant faking those
// fields, which is how a screen starts describing something that does not exist.
//
// The chain here is SYNTHETIC and the page says so at every turn. Real option history is
// still accumulating from the nightly snapshot; until there is enough, this shows whether
// the rules execute and nothing about whether they make money.

const UNDERLYINGS = [
    { symbol: 'NIFTY 50', label: 'NIFTY', step: 50, lot: 65 },
    { symbol: 'NIFTY BANK', label: 'BANKNIFTY', step: 100, lot: 30 },
];

const TRADE_COLUMNS: Column<OptionsTrade>[] = [
    { key: 'opened', header: 'Opened', width: '80px', align: 'right', render: (t) => <span className="mono text-xs text-faint">{t.openedAt}</span> },
    { key: 'closed', header: 'Closed', width: '80px', align: 'right', render: (t) => <span className="mono text-xs text-faint">{t.closedAt}</span> },
    {
        key: 'legs', header: 'Structure', width: '1.6fr',
        render: (t) => <span className="mono text-2xs text-faint">{describeLegs(t.legs)}</span>,
    },
    { key: 'credit', header: 'Credit', width: '90px', align: 'right', render: (t) => <span className="mono text-xs">{t.netCredit.toFixed(2)}</span> },
    {
        key: 'pnl', header: 'P&L', width: '110px', align: 'right',
        render: (t) => (
            <span className="mono text-xs" style={{ color: t.pnl >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtMoney(t.pnl, 'INR', 0)}</span>
        ),
    },
    { key: 'charges', header: 'Charges', width: '90px', align: 'right', render: (t) => <span className="mono text-xs text-faint">{fmtMoney(t.charges, 'INR', 0)}</span> },
    {
        key: 'why', header: 'Closed because', width: '1.4fr',
        render: (t) => <span className="text-2xs text-faint">{t.settled ? 'Expired — settled at intrinsic.' : t.reason}</span>,
    },
];

const describeLegs = (legs: LegSpec[]) =>
    legs.map((l) => `${l.side === 'sell' ? '−' : '+'}${l.strike}${l.optionType}`).join(' ');

export default function OptionsStrategyPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const strategy = optionsStrategyById(id);

    const [underlying, setUnderlying] = useState(UNDERLYINGS[0]);
    const [capital, setCapital] = useState(2_000_000);
    const [cycle, setCycle] = useState(20);
    const [values, setValues] = useState<Params>(() => (strategy ? defaultParams(strategy) : {}));
    const [result, setResult] = useState<OptionsBacktestResult | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const run = useCallback(async () => {
        if (!strategy) return;
        setBusy(true);
        setError('');
        try {
            const price = useMarketStore.getState().quotes[underlying.symbol]?.price;
            const res = await fetch(candlesUrl(underlying.symbol, '1d', 1000, price));
            if (!res.ok) throw new Error(`Could not load candles (${res.status}).`);
            const data = await res.json();
            const bars = data?.candles ?? [];
            if (bars.length < 60) throw new Error('Not enough underlying history to build a chain series.');

            const chains = syntheticChainSeries(bars, cycle, { step: underlying.step, width: 12 });
            if (!chains.length) throw new Error('No chain could be built — volatility was not estimable over this series.');

            setResult(runOptionsBacktest({
                strategy,
                params: values,
                bars,
                chains,
                lotSize: underlying.lot,
                startingCapital: capital,
            }));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'The run failed.');
            setResult(null);
        } finally {
            setBusy(false);
        }
    }, [strategy, underlying, cycle, values, capital]);

    const benchmark = useMemo(
        () => (result ? result.equity.map(() => capital) : []),
        [result, capital]
    );

    if (!strategy) notFound();

    return (
        <PageShell width="wide" title={strategy.name} subtitle={strategy.explain.idea}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge tone="accent">options</Badge>
                <Badge>multi-leg</Badge>
                <Badge>NIFTY / BANKNIFTY</Badge>
                <Badge>European · cash-settled</Badge>
            </div>

            <Callout tone="warn">
                Backtested against a <strong>synthetic</strong> chain. Real option history is still
                accumulating from the nightly snapshot — until there is enough, this shows whether the
                rules execute and is <strong>not</strong> evidence they make money.{' '}
                <Link href="/options" className="underline underline-offset-2">Trade the live chain</Link>.
            </Callout>

            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <div className="min-w-0">
                    <Panel title="The rules" className="mt-5">
                        <dl className="flex flex-col gap-3 text-sm">
                            <div>
                                <dt className="text-2xs font-bold tracking-wide text-faint">ENTRY</dt>
                                <dd className="mt-0.5 text-foreground-muted">{strategy.explain.entry}</dd>
                            </div>
                            <div>
                                <dt className="text-2xs font-bold tracking-wide text-faint">EXIT</dt>
                                <dd className="mt-0.5 text-foreground-muted">{strategy.explain.exit}</dd>
                            </div>
                            {strategy.explain.whenItWorks && (
                                <div>
                                    <dt className="text-2xs font-bold tracking-wide text-up">WHERE IT MAKES MONEY</dt>
                                    <dd className="mt-0.5 text-foreground-muted">{strategy.explain.whenItWorks}</dd>
                                </div>
                            )}
                            <div>
                                <dt className="text-2xs font-bold tracking-wide text-down">WHERE IT LOSES MONEY</dt>
                                <dd className="mt-0.5 text-foreground-muted">{strategy.explain.whenItFails}</dd>
                            </div>
                        </dl>

                        {strategy.caveats?.length ? (
                            <ul className="mt-4 ml-4 list-disc space-y-1 border-t border-border2 pt-3 text-xs text-warn">
                                {strategy.caveats.map((c) => <li key={c}>{c}</li>)}
                            </ul>
                        ) : null}
                    </Panel>

                    <Panel title="Parameters" className="mt-5">
                        <ParamForm specs={strategy.params} values={values} onChange={setValues} disabled={busy} />
                        <div className="mt-4 flex gap-2">
                            <Button variant="primary" onClick={run} loading={busy}>Run on a synthetic chain</Button>
                            <Button variant="ghost" onClick={() => setValues(defaultParams(strategy))} disabled={busy}>Reset</Button>
                        </div>
                    </Panel>

                    {error && <Callout tone="down">{error}</Callout>}

                    {result && (
                        <>
                            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <Tile label="NET RETURN" value={fmtPct(result.netPct)} tone={result.netPct >= 0 ? 'up' : 'down'} sub={fmtMoney(result.finalValue, 'INR', 0)} />
                                <Tile label="MAX DRAWDOWN" value={fmtPct(result.maxDD)} tone="down" />
                                <Tile label="STRUCTURES" value={String(result.trades.length)} sub={`${result.wins} won · ${result.losses} lost`} />
                                <Tile label="CHARGES" value={fmtMoney(result.charges, 'INR', 0)} sub="every leg, both ways" />
                            </div>

                            {result.warnings.map((w) => <Callout key={w} tone="warn">{w}</Callout>)}

                            {result.suppressed.length > 0 && (
                                <p className="mt-3 text-xs text-faint">
                                    Withheld because the sample cannot support them: {result.suppressed.join(', ')}.
                                </p>
                            )}

                            <Panel title="Equity" className="mt-5">
                                <MultiLine
                                    label="Structure equity against doing nothing"
                                    series={[
                                        { points: benchmark, label: 'no position', color: 'var(--faint)', dashed: true },
                                        { points: result.equity, label: 'strategy', color: 'var(--accent)' },
                                    ]}
                                />
                            </Panel>

                            <Panel title="Drawdown" className="mt-5">
                                <DrawdownChart points={result.drawdown} />
                            </Panel>

                            <Panel title={`Every structure (${result.trades.length})`} className="mt-5" padding="none">
                                {result.trades.length === 0 ? (
                                    <p className="p-4 text-sm text-faint">
                                        No structures were opened. Read the warnings above — on a synthetic chain that is
                                        usually a property of the data rather than a verdict on the strategy.
                                    </p>
                                ) : (
                                    <DataTable
                                        columns={TRADE_COLUMNS}
                                        rows={result.trades}
                                        getRowKey={(t) => `${t.openedAt}-${t.closedAt}`}
                                        minWidth={860}
                                    />
                                )}
                            </Panel>
                        </>
                    )}
                </div>

                <aside className="min-w-0">
                    <Panel title="Test against" className="mt-5">
                        <div className="flex flex-col gap-4">
                            <Field label="Underlying" hint="Lot size and strike spacing follow the contract.">
                                <Select
                                    value={underlying.label}
                                    onChange={(e) => setUnderlying(UNDERLYINGS.find((u) => u.label === e.target.value) ?? UNDERLYINGS[0])}
                                    disabled={busy}
                                >
                                    {UNDERLYINGS.map((u) => <option key={u.label} value={u.label}>{u.label}</option>)}
                                </Select>
                            </Field>
                            <Field label="Expiry cycle" hint="Bars between expiries. 20 is roughly a monthly cycle on daily bars.">
                                <Input type="number" min={5} max={60} value={cycle} onChange={(e) => setCycle(Math.max(5, Number(e.target.value) || 20))} disabled={busy} />
                            </Field>
                            <Field label="Starting capital" hint="Options brokerage is flat per leg, so size changes the cost ratio.">
                                <Input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value) || 0)} disabled={busy} />
                            </Field>
                        </div>
                    </Panel>

                    <Panel title="Trade this live" className="mt-5">
                        <p className="text-xs text-foreground-muted">
                            This structure can be placed by hand against the real NSE chain, with real premiums and
                            real margin.
                        </p>
                        <Link href="/options" className="mt-3 inline-block text-sm text-accent underline underline-offset-2">
                            Open the option chain →
                        </Link>
                    </Panel>
                </aside>
            </div>
        </PageShell>
    );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' }) {
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
