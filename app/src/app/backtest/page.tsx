'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageShell, Panel, Badge, Button, Callout, Field, Select, Input, DataTable, type Column } from '@/components/ui';
import { allStrategies } from '@/lib/strategies/defs';
import { defaultParams } from '@/lib/strategies/types';
import { runStrategyBacktest } from '@/lib/strategies/backtest';
import { candlesUrl } from '@/lib/marketData/candlesUrl';
import { allInstruments } from '@/lib/instruments';
import { marketOf } from '@/lib/paperEngine';
import { useMarketStore } from '@/stores/marketStore';
import { TIMEFRAMES } from '@/lib/constants';
import { fmtPct, fmtMoney } from '@/lib/format';

// Compare every applicable strategy on one instrument, at default settings.
//
// Defaults on purpose. The moment you tune parameters per strategy you are choosing the
// winner with hindsight, and the ranking stops meaning anything. This screen answers a
// narrower and more useful question: on this instrument, over this window, which of
// these ideas did anything at all — and did any of them beat simply holding it?

interface Row {
    id: string;
    name: string;
    family: string;
    netPct: number;
    benchmarkPct: number;
    maxDD: number;
    trades: number;
    exposure: number;
    suppressed: number;
}

const COLUMNS: Column<Row>[] = [
    {
        key: 'name', header: 'Strategy', width: '1.6fr',
        render: (r) => (
            <Link href={`/strategies/${r.id}`} className="text-sm font-semibold hover:text-accent">
                {r.name}
                <span className="ml-2 text-2xs font-normal text-faint">{r.family}</span>
            </Link>
        ),
    },
    {
        key: 'net', header: 'Return', width: '110px', align: 'right',
        render: (r) => (
            <span className="mono text-sm" style={{ color: r.netPct >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtPct(r.netPct)}</span>
        ),
    },
    {
        key: 'vs', header: 'vs hold', width: '110px', align: 'right',
        render: (r) => {
            const diff = r.netPct - r.benchmarkPct;
            return <span className="mono text-sm" style={{ color: diff >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtPct(diff)}</span>;
        },
    },
    { key: 'dd', header: 'Max DD', width: '100px', align: 'right', render: (r) => <span className="mono text-sm text-down">{fmtPct(r.maxDD)}</span> },
    { key: 'trades', header: 'Trades', width: '80px', align: 'right', render: (r) => <span className="mono text-sm">{r.trades}</span> },
    { key: 'exp', header: 'Exposure', width: '90px', align: 'right', render: (r) => <span className="mono text-sm text-faint">{(r.exposure * 100).toFixed(0)}%</span> },
];

export default function BacktestPage() {
    const instruments = useMemo(() => allInstruments(), []);
    const [symbol, setSymbol] = useState(instruments[0]?.symbol ?? 'AAPL');
    const [timeframe, setTimeframe] = useState('1d');
    const [capital, setCapital] = useState(100_000);
    const [rows, setRows] = useState<Row[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [meta, setMeta] = useState<{ bars: number; source: string; synthetic: boolean } | null>(null);

    const run = useCallback(async () => {
        setBusy(true);
        setError('');
        try {
            const price = useMarketStore.getState().quotes[symbol]?.price;
            const res = await fetch(candlesUrl(symbol, timeframe, 1000, price));
            if (!res.ok) throw new Error(`Could not load candles (${res.status}).`);
            const data = await res.json();
            const bars = data?.candles ?? [];
            if (!bars.length) throw new Error('No candles came back for this instrument.');

            setMeta({ bars: bars.length, source: data?.source ?? 'unknown', synthetic: !!data?.synthetic });

            const market = marketOf(symbol);
            const barSeconds = TIMEFRAMES.find((t) => t.value === timeframe)?.seconds ?? 86_400;

            // Single-instrument strategies only. A pair or universe strategy needs a
            // second series chosen deliberately, and picking one automatically would be
            // inventing half the strategy.
            const applicable = allStrategies().filter(
                (s) => !s.signalOnly && s.shape === 'single' && s.markets.includes(market)
            );

            const out: Row[] = applicable.map((s) => {
                const r = runStrategyBacktest({
                    strategy: s,
                    params: defaultParams(s),
                    symbol,
                    market,
                    bars,
                    barSeconds,
                    startingCapital: capital,
                });
                return {
                    id: s.id,
                    name: s.name,
                    family: s.family,
                    netPct: r.metrics.netPct,
                    benchmarkPct: r.metrics.benchmarkPct,
                    maxDD: r.metrics.maxDD,
                    trades: r.metrics.trades,
                    exposure: r.metrics.exposure,
                    suppressed: r.suppressed.length,
                };
            });

            out.sort((a, b) => b.netPct - a.netPct);
            setRows(out);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'The comparison failed.');
            setRows(null);
        } finally {
            setBusy(false);
        }
    }, [symbol, timeframe, capital]);

    const benchmark = rows?.[0]?.benchmarkPct ?? 0;
    const beat = rows?.filter((r) => r.netPct > r.benchmarkPct).length ?? 0;
    const inactive = rows?.filter((r) => r.trades === 0).length ?? 0;

    return (
        <PageShell
            title="Compare strategies"
            coachTopic="backtest"
            subtitle="Every single-instrument strategy, run at its DEFAULT settings on one instrument. Tuning each one first would be choosing the winner with hindsight."
        >
            <Panel>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Instrument" hint="Strategies are filtered to those that target this market.">
                        <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                            {instruments.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
                        </Select>
                    </Field>
                    <Field label="Timeframe" hint="Daily bars give about two years; intraday gives far less.">
                        <Select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                            {TIMEFRAMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </Select>
                    </Field>
                    <Field label="Starting capital" hint="Brokerage is capped per order, so size genuinely changes the ranking.">
                        <Input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value) || 0)} />
                    </Field>
                </div>
                <Button variant="primary" className="mt-4" onClick={run} loading={busy}>Run comparison</Button>
            </Panel>

            {error && <Callout tone="down">{error}</Callout>}

            {meta?.synthetic && (
                <Callout tone="warn">
                    No provider covers this instrument at this timeframe, so the series is <strong>generated</strong>.
                    Nothing below is a historical result — it only shows that the rules execute.
                </Callout>
            )}

            {rows && (
                <>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        <Badge tone={benchmark >= 0 ? 'up' : 'down'}>Buy &amp; hold {fmtPct(benchmark)}</Badge>
                        <Badge tone={beat > 0 ? 'up' : 'neutral'}>{beat} of {rows.length} beat it</Badge>
                        {inactive > 0 && <Badge>{inactive} took no trades</Badge>}
                        {meta && !meta.synthetic && <span className="text-xs text-faint">real data · {meta.source} · {meta.bars} bars</span>}
                    </div>

                    <p className="mt-2 text-xs text-faint">
                        Sorted by return, which is the wrong way to choose one. Look at the drawdown it took to get
                        there and how many trades produced it — a large return from three trades is luck, not an edge.
                    </p>

                    <Panel className="mt-4" padding="none">
                        <DataTable columns={COLUMNS} rows={rows} getRowKey={(r) => r.id} minWidth={720} />
                    </Panel>
                </>
            )}

            {!rows && !busy && !error && (
                <p className="mt-5 text-sm text-faint">
                    Pick an instrument and run. Pair and spread strategies are excluded here because they need a
                    second instrument chosen deliberately — open those from the{' '}
                    <Link href="/strategies" className="text-accent underline underline-offset-2">strategy library</Link>.
                </p>
            )}
        </PageShell>
    );
}
