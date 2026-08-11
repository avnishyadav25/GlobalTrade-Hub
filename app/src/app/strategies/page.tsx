'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PageShell, Panel, Badge, Button, SegmentedControl } from '@/components/ui';
import { allStrategies } from '@/lib/strategies/defs';
import { useStrategyStore } from '@/stores/strategyStore';
import { useSignalStore } from '@/stores/signalStore';
import { MARKET_LABELS } from '@/lib/constants';
import type { Family } from '@/lib/strategies/types';

const FAMILY_LABEL: Record<Family, string> = {
    benchmark: 'Benchmark',
    trend: 'Trend following',
    meanReversion: 'Mean reversion',
    breakout: 'Breakout',
    session: 'Session',
    spread: 'Spread and relative value',
    volatility: 'Volatility',
    range: 'Range',
    event: 'Event driven',
};

const FAMILY_BLURB: Record<Family, string> = {
    benchmark: 'The bar every other strategy has to clear.',
    trend: 'Buy strength, sell weakness. Low win rate, large winners.',
    meanReversion: 'Fade the extremes. High win rate, occasional very large loss.',
    breakout: 'Trade the moment a range gives way.',
    session: 'Rules that only mean something relative to the trading day.',
    spread: 'Trade the relationship between two instruments, not the direction of either.',
    volatility: 'How much you hold, rather than when you buy.',
    range: 'Harvest oscillation — until the range breaks.',
    event: 'React to scheduled real-world releases.',
};

const ORDER: Family[] = ['benchmark', 'trend', 'meanReversion', 'session', 'spread', 'volatility', 'range', 'event', 'breakout'];

export default function StrategiesPage() {
    const [market, setMarket] = useState<string>('all');
    const strategies = useMemo(() => allStrategies(), []);
    const instances = useStrategyStore((s) => s.instances);
    const pending = useSignalStore((s) => s.signals.filter((x) => x.status === 'pending').length);

    const visible = useMemo(
        () => (market === 'all' ? strategies : strategies.filter((s) => s.markets.includes(market as never))),
        [strategies, market]
    );

    const byFamily = useMemo(() => {
        const map = new Map<Family, typeof strategies>();
        for (const s of visible) map.set(s.family, [...(map.get(s.family) ?? []), s]);
        return map;
    }, [visible]);

    const enabledFor = (id: string) => instances.filter((i) => i.strategyId === id && i.enabled).length;

    return (
        <PageShell
            title="Strategies"
            coachTopic="strategies"
            subtitle="Twenty rule sets you can backtest against real data, then run in review mode. Each one states where it loses money as plainly as what it does."
            actions={
                <Link href="/signals">
                    <Button variant={pending ? 'primary' : 'secondary'}>
                        Signals{pending ? ` (${pending})` : ''}
                    </Button>
                </Link>
            }
        >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl
                    label="Market"
                    size="sm"
                    value={market}
                    onChange={setMarket}
                    options={[
                        { value: 'all', label: 'All' },
                        { value: 'india', label: 'India' },
                        { value: 'us', label: 'US' },
                        { value: 'crypto', label: 'Crypto' },
                        { value: 'forex', label: 'FX' },
                        { value: 'commodity', label: 'Comm' },
                    ]}
                />
                <Link href="/strategies/unavailable" className="text-xs text-faint underline underline-offset-2 hover:text-foreground">
                    What is not here, and why
                </Link>
            </div>

            {ORDER.filter((f) => byFamily.has(f)).map((family) => (
                <section key={family} className="mb-7">
                    <header className="mb-2.5">
                        <h2 className="text-md font-semibold">{FAMILY_LABEL[family]}</h2>
                        <p className="text-xs text-faint">{FAMILY_BLURB[family]}</p>
                    </header>

                    <div className="flex flex-col gap-2">
                        {byFamily.get(family)!.map((s) => {
                            const running = enabledFor(s.id);
                            return (
                                <Link key={s.id} href={`/strategies/${s.id}`} className="panel block p-3.5 transition-colors hover:border-accent">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-semibold">{s.name}</span>
                                                {s.signalOnly && <Badge tone="warn">signal only</Badge>}
                                                {running > 0 && <Badge tone="up">running</Badge>}
                                                {s.shape !== 'single' && <Badge>{s.shape}</Badge>}
                                            </div>
                                            <p className="mt-1 max-w-[70ch] text-xs text-foreground-muted">{s.explain.entry}</p>
                                            {s.caveats?.length ? (
                                                <p className="mt-1 text-2xs text-warn">{s.caveats[0]}</p>
                                            ) : null}
                                        </div>
                                        <div className="flex shrink-0 flex-wrap gap-1">
                                            {s.markets.map((m) => (
                                                <Badge key={m}>{MARKET_LABELS[m] ?? m}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            ))}
        </PageShell>
    );
}
