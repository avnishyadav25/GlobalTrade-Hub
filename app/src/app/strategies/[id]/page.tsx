'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { toast } from 'sonner';
import { PageShell, Panel, Badge, Button, Callout, Field, Select, Input } from '@/components/ui';
import { ParamForm } from '@/components/strategies/ParamForm';
import { StrategyResults } from '@/components/strategies/StrategyResults';
import { strategyById } from '@/lib/strategies/defs';
import { defaultParams, type Params } from '@/lib/strategies/types';
import { runStrategyBacktest, type StrategyBacktestResult } from '@/lib/strategies/backtest';
import { candlesUrl } from '@/lib/marketData/candlesUrl';
import { allInstruments } from '@/lib/instruments';
import { marketOf } from '@/lib/paperEngine';
import { useStrategyStore } from '@/stores/strategyStore';
import { useMarketStore } from '@/stores/marketStore';
import { TIMEFRAMES } from '@/lib/constants';
import type { Candle } from '@/lib/mockData';

type RunState = 'idle' | 'loading' | 'done' | 'error';

export default function StrategyDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const strategy = strategyById(id);

    const instruments = useMemo(() => allInstruments(), []);
    const [symbol, setSymbol] = useState('');
    const [timeframe, setTimeframe] = useState('1d');
    const [capital, setCapital] = useState(100_000);
    const [values, setValues] = useState<Params>({});
    const [roles, setRoles] = useState<Record<string, string>>({});
    const [result, setResult] = useState<StrategyBacktestResult | null>(null);
    const [state, setState] = useState<RunState>('idle');
    const [error, setError] = useState('');
    const [source, setSource] = useState<{ source: string; synthetic: boolean; bars: number } | null>(null);

    const instances = useStrategyStore((s) => s.instances);
    const addInstance = useStrategyStore((s) => s.add);
    const removeInstance = useStrategyStore((s) => s.remove);
    const setMode = useStrategyStore((s) => s.setMode);

    // Default the form once the strategy resolves.
    useEffect(() => {
        if (!strategy) return;
        setValues(defaultParams(strategy));
        const first = instruments.find((a) => strategy.markets.includes(a.market));
        if (first) setSymbol(first.symbol);
    }, [strategy, instruments]);

    const fetchBars = useCallback(async (sym: string, tf: string): Promise<{ candles: Candle[]; synthetic: boolean; source: string } | null> => {
        const price = useMarketStore.getState().quotes[sym]?.price;
        const res = await fetch(candlesUrl(sym, tf, 1000, price));
        if (!res.ok) return null;
        const data = await res.json();
        return { candles: data?.candles ?? [], synthetic: !!data?.synthetic, source: data?.source ?? 'unknown' };
    }, []);

    const run = useCallback(async () => {
        if (!strategy || !symbol) return;
        setState('loading');
        setError('');
        try {
            const primary = await fetchBars(symbol, timeframe);
            if (!primary?.candles.length) throw new Error('No candles came back for this instrument.');

            const others: Record<string, Candle[]> = {};
            for (const req of strategy.requires ?? []) {
                const roleSymbol = roles[req.role];
                if (!roleSymbol) throw new Error(`This strategy needs a second instrument for "${req.role}".`);
                const extra = await fetchBars(roleSymbol, timeframe);
                if (!extra?.candles.length) throw new Error(`No candles for ${roleSymbol}.`);
                others[req.role] = extra.candles;
            }

            setSource({ source: primary.source, synthetic: primary.synthetic, bars: primary.candles.length });
            setResult(
                runStrategyBacktest({
                    strategy,
                    params: values,
                    symbol,
                    market: marketOf(symbol),
                    bars: primary.candles,
                    barSeconds: TIMEFRAMES.find((t) => t.value === timeframe)?.seconds ?? 86_400,
                    startingCapital: capital,
                    others: Object.keys(others).length ? others : undefined,
                })
            );
            setState('done');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'The backtest failed.');
            setState('error');
        }
    }, [strategy, symbol, timeframe, capital, values, roles, fetchBars]);

    if (!strategy) notFound();

    const mine = instances.filter((i) => i.strategyId === strategy.id);
    const eligible = instruments.filter((a) => strategy.markets.includes(a.market));

    const enable = () => {
        if (!symbol) return;
        addInstance({ strategyId: strategy.id, symbol, timeframe, params: values, enabled: true, mode: 'review' });
        toast.success(`${strategy.name} is running on ${symbol}`, {
            description: 'It will post signals to the Signals screen. Nothing is placed without your approval.',
        });
    };

    return (
        <PageShell width="wide" title={strategy.name} subtitle={strategy.explain.idea}>
            <div className="mb-5 flex flex-wrap items-center gap-2">
                <Badge>{strategy.family}</Badge>
                {strategy.markets.map((m) => <Badge key={m}>{m}</Badge>)}
                {strategy.shape !== 'single' && <Badge tone="accent">{strategy.shape}</Badge>}
                {strategy.signalOnly && <Badge tone="warn">signal only</Badge>}
            </div>

            {strategy.signalOnly && (
                <Callout tone="warn">
                    This strategy cannot be traded here. It exists to make something readable, and it will never
                    open a position — see the caveats below for why.
                </Callout>
            )}

            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <div className="min-w-0">
                    <Panel title="The rules">
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

                        {strategy.explain.lesson && (
                            <Link href={`/learn/${strategy.explain.lesson}`} className="mt-4 inline-block text-sm text-accent underline underline-offset-2">
                                Learn the concept behind this →
                            </Link>
                        )}
                    </Panel>

                    <Panel title="Parameters" className="mt-5">
                        <ParamForm specs={strategy.params} values={values} onChange={setValues} disabled={state === 'loading'} />
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-border2 pt-4">
                            <Button variant="primary" onClick={run} loading={state === 'loading'} disabled={!symbol}>
                                Run backtest
                            </Button>
                            <Button variant="ghost" onClick={() => setValues(defaultParams(strategy))}>Reset to defaults</Button>
                        </div>
                    </Panel>

                    {state === 'error' && <Callout tone="down">{error}</Callout>}

                    {result && (
                        <div className="mt-5">
                            {source?.synthetic ? (
                                <Callout tone="warn">
                                    No provider covers this instrument at this timeframe, so the series is
                                    <strong> generated</strong>. This is not a historical backtest — treat it as a check
                                    that the rules run, and nothing more.
                                </Callout>
                            ) : (
                                <p className="mb-3 text-xs text-faint">
                                    Real data · {source?.source} · {source?.bars} bars
                                </p>
                            )}
                            <StrategyResults result={result} />
                        </div>
                    )}
                </div>

                <aside className="min-w-0">
                    <Panel title="Test against">
                        <Field label="Instrument" hint="Only instruments in the markets this strategy targets.">
                            <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                                {eligible.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
                            </Select>
                        </Field>

                        {(strategy.requires ?? []).map((req) => (
                            <Field key={req.role} label={`Second instrument — ${req.role}`} hint={req.hint}>
                                <Select value={roles[req.role] ?? ''} onChange={(e) => setRoles({ ...roles, [req.role]: e.target.value })}>
                                    <option value="">Choose one…</option>
                                    {instruments.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
                                </Select>
                            </Field>
                        ))}

                        <Field label="Timeframe" hint="Indian intraday history is about 28 days, which is too short to validate an intraday rule.">
                            <Select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                                {TIMEFRAMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </Select>
                        </Field>

                        <Field label="Starting capital" hint="Costs are charged on every fill, and brokerage is capped per order — so size changes the result.">
                            <Input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value) || 0)} />
                        </Field>
                    </Panel>

                    {!strategy.signalOnly && (
                        <Panel title="Run it live" className="mt-5">
                            <p className="text-xs text-foreground-muted">
                                Runs against live candles and posts what it wants to do to the Signals screen.
                                Nothing is placed until you approve it.
                            </p>
                            <Button variant="primary" className="mt-3 w-full" onClick={enable} disabled={!symbol}>
                                Enable on {symbol || '…'}
                            </Button>

                            {mine.length > 0 && (
                                <ul className="mt-4 flex flex-col gap-2 border-t border-border2 pt-3">
                                    {mine.map((i) => (
                                        <li key={i.id} className="flex items-center justify-between gap-2 text-xs">
                                            <span className="min-w-0 truncate">
                                                {i.symbol} · {i.timeframe} · {i.mode}
                                            </span>
                                            <span className="flex shrink-0 gap-1">
                                                <button
                                                    onClick={() => setMode(i.id, i.mode === 'auto' ? 'review' : 'auto')}
                                                    className="text-faint underline underline-offset-2 hover:text-foreground"
                                                >
                                                    {i.mode === 'auto' ? 'to review' : 'to auto'}
                                                </button>
                                                <button onClick={() => removeInstance(i.id)} className="text-faint hover:text-down">stop</button>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>
                    )}
                </aside>
            </div>
        </PageShell>
    );
}
