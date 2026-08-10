'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell, Panel, Badge, Button, Callout } from '@/components/ui';
import { LESSONS, lessonBySlug } from '@/lib/learn/curriculum';
import { useLearnStore } from '@/stores/learnStore';
import { usePaperStore } from '@/stores/paperStore';
import { useMarketStore } from '@/stores/marketStore';

/** Minimal **bold** rendering so lesson prose can carry emphasis without a markdown dep. */
function Rich({ text }: { text: string }) {
    return (
        <p className="mb-3 text-base leading-relaxed text-foreground-muted last:mb-0">
            {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                part.startsWith('**') && part.endsWith('**')
                    ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
                    : <span key={i}>{part}</span>
            )}
        </p>
    );
}

export default function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const lesson = lessonBySlug(slug);
    const complete = useLearnStore((s) => s.complete);
    const completed = useLearnStore((s) => s.completed);
    const observedSymbols = useLearnStore((s) => s.observedSymbols);
    const observedMarkets = useLearnStore((s) => s.observedMarkets);
    const state = usePaperStore((s) => s.state);
    const quotes = useMarketStore((s) => s.quotes);
    const [answers, setAnswers] = useState<Record<number, number>>({});

    if (!lesson) notFound();

    const idx = LESSONS.findIndex((l) => l.slug === slug);
    const next = LESSONS[idx + 1];
    const result = lesson.exercise.verify({ state, quotes, observed: { symbols: observedSymbols, markets: observedMarkets } });
    const isDone = result.done || !!completed[slug];

    // Recording completion is a side effect — doing it during render updates another
    // component mid-render, which React warns about.
    useEffect(() => {
        if (result.done && !completed[slug]) complete(slug);
    }, [result.done, completed, slug, complete]);

    return (
        <PageShell
            width="narrow"
            title={lesson.title}
            subtitle={lesson.outcome}
            actions={<Link href="/learn" className="text-sm font-semibold text-accent">← All lessons</Link>}
        >
            <div className="mb-4 flex items-center gap-2">
                <Badge tone="accent">Lesson {idx + 1} of {LESSONS.length}</Badge>
                <Badge>{lesson.minutes} min</Badge>
                {isDone && <Badge tone="up">Exercise complete</Badge>}
            </div>

            <Panel title="The idea" className="mb-4">
                {lesson.concept.map((c, i) => <Rich key={i} text={c} />)}
            </Panel>

            <Panel title="Where it lives in this app" className="mb-4">
                <Rich text={lesson.inApp} />
            </Panel>

            <Panel title={`Exercise — ${lesson.exercise.title}`} className="mb-4">
                <Rich text={lesson.exercise.body} />
                <div className={`mt-3 rounded-sm px-3.5 py-2.5 text-sm ${isDone ? 'bg-up-dim text-up' : 'bg-chip text-foreground-muted'}`}>
                    <strong className="font-semibold">{isDone ? '✓ Done. ' : 'Not yet. '}</strong>
                    {result.hint}
                </div>
                {result.progress != null && !isDone && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-chip">
                        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${result.progress * 100}%` }} />
                    </div>
                )}
                {!isDone && (
                    <p className="mt-2 text-xs text-faint">
                        This checks your actual paper account — there is no way to tick it off without doing it.
                    </p>
                )}
            </Panel>

            <Panel title="Check yourself" className="mb-4">
                {lesson.quiz.map((q, qi) => {
                    const picked = answers[qi];
                    return (
                        <div key={qi} className="mb-4 last:mb-0">
                            <div className="mb-2 text-sm font-semibold">{q.question}</div>
                            <div className="flex flex-col gap-1.5">
                                {q.options.map((o, oi) => {
                                    const chosen = picked === oi;
                                    const right = oi === q.answer;
                                    return (
                                        <button
                                            key={oi}
                                            onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                                            className={`rounded-sm border px-3 py-2 text-left text-sm transition-colors ${
                                                picked == null
                                                    ? 'border-border hover:border-border-hover'
                                                    : right
                                                      ? 'border-up/50 bg-up-dim text-up'
                                                      : chosen
                                                        ? 'border-down/50 bg-down-dim text-down'
                                                        : 'border-border opacity-60'
                                            }`}
                                        >
                                            {o}
                                        </button>
                                    );
                                })}
                            </div>
                            {picked != null && <p className="mt-2 text-xs text-faint">{q.why}</p>}
                        </div>
                    );
                })}
            </Panel>

            {!isDone && <Callout tone="accent">Do the exercise in the app, then come back — this page updates itself.</Callout>}

            {next && (
                <div className="mt-5 flex justify-end">
                    <Link href={`/learn/${next.slug}`}>
                        <Button variant="primary">Next: {next.title} →</Button>
                    </Link>
                </div>
            )}
        </PageShell>
    );
}
