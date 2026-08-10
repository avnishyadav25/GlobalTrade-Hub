'use client';

import Link from 'next/link';
import { PageShell, Panel, Badge, Button } from '@/components/ui';
import { LESSONS } from '@/lib/learn/curriculum';
import { useLearnStore } from '@/stores/learnStore';
import { usePaperStore } from '@/stores/paperStore';
import { useMarketStore } from '@/stores/marketStore';

export default function LearnPage() {
    const completed = useLearnStore((s) => s.completed);
    const state = usePaperStore((s) => s.state);
    const quotes = useMarketStore((s) => s.quotes);
    const observedSymbols = useLearnStore((s) => s.observedSymbols);
    const observedMarkets = useLearnStore((s) => s.observedMarkets);

    const ctx = { state, quotes, observed: { symbols: observedSymbols, markets: observedMarkets } };
    const done = LESSONS.filter((l) => l.exercise.verify(ctx).done || completed[l.slug]).length;
    const next = LESSONS.find((l) => !(l.exercise.verify(ctx).done || completed[l.slug])) ?? LESSONS[0];

    return (
        <PageShell
            title="Learn to trade"
            subtitle="Ten short lessons, each with one exercise checked against your own paper account — not a “mark as done” button."
            actions={<Button variant="primary" onClick={() => (window.location.href = `/learn/${next.slug}`)}>Continue: {next.title}</Button>}
        >
            <Panel className="mb-5">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-md font-semibold">{done} of {LESSONS.length} complete</div>
                        <div className="text-sm text-foreground-muted">
                            Exercises verify against your real trades, so progress here means you actually did it.
                        </div>
                    </div>
                    <div className="mono text-2xl font-bold text-accent">{Math.round((done / LESSONS.length) * 100)}%</div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-chip">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(done / LESSONS.length) * 100}%` }} />
                </div>
            </Panel>

            <div className="grid gap-3.5 md:grid-cols-2">
                {LESSONS.map((l, i) => {
                    const result = l.exercise.verify(ctx);
                    const isDone = result.done || !!completed[l.slug];
                    return (
                        <Link key={l.slug} href={`/learn/${l.slug}`} className="panel block p-4 transition-colors hover:border-border-hover">
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                <span className="text-2xs font-semibold uppercase tracking-wide text-faint">Lesson {i + 1} · {l.minutes} min</span>
                                <Badge tone={isDone ? 'up' : 'neutral'}>{isDone ? 'Done' : 'To do'}</Badge>
                            </div>
                            <div className="text-md font-semibold">{l.title}</div>
                            <p className="mt-1 text-sm text-foreground-muted">{l.outcome}</p>
                        </Link>
                    );
                })}
            </div>
        </PageShell>
    );
}
