'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell, Panel, Badge, Button } from '@/components/ui';
import { TRACKS, LEVELS, type TrackId } from '@/lib/learn/types';
import { useCourseProgress } from '@/lib/learn/progress';

export default function TrackPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const track = TRACKS.find((t) => t.id === id);
    const progress = useCourseProgress();

    const lessons = useMemo(
        () => progress.lessons.filter((p) => p.lesson.track === (id as TrackId)),
        [progress.lessons, id]
    );

    if (!track) notFound();

    const done = lessons.filter((p) => p.done).length;
    const nextInTrack = lessons.find((p) => !p.done && !p.skipped);

    return (
        <PageShell
            width="narrow"
            title={track.title}
            subtitle={track.blurb}
            actions={
                nextInTrack ? (
                    <Link href={`/learn/${nextInTrack.lesson.slug}`}><Button variant="primary">Continue</Button></Link>
                ) : undefined
            }
        >
            <Panel className="mb-6">
                <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{done} of {lessons.length} complete</span>
                    <Link href="/learn" className="text-xs text-faint hover:text-foreground">All tracks</Link>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${lessons.length ? (done / lessons.length) * 100 : 0}%` }} />
                </div>
            </Panel>

            {lessons.length === 0 && (
                <p className="text-sm text-faint">
                    This track has no lessons yet. It is listed because the subject is planned, not because
                    content exists — an empty track is more honest than a placeholder one.
                </p>
            )}

            {LEVELS.map((level) => {
                const atLevel = lessons.filter((p) => p.lesson.level === level.key);
                if (!atLevel.length) return null;

                return (
                    <section key={level.key} className="mb-7">
                        <header className="mb-2.5">
                            <h2 className="text-md font-semibold">{level.title}</h2>
                            <p className="text-xs text-faint">{level.blurb}</p>
                        </header>

                        <div className="flex flex-col gap-2">
                            {atLevel.map((p) => (
                                <Link key={p.lesson.slug} href={`/learn/${p.lesson.slug}`} className="panel block p-3.5 transition-colors hover:border-accent">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold">{p.lesson.title}</span>
                                        <Badge tone={p.done ? 'up' : 'neutral'}>{p.done ? 'Done' : `${p.lesson.minutes} min`}</Badge>
                                        <Badge tone={p.lesson.kind === 'practice' ? 'accent' : 'neutral'}>{p.lesson.kind}</Badge>
                                        {p.skipped && !p.done && <Badge tone="warn">Skipped</Badge>}
                                    </div>
                                    <p className="mt-1 text-xs text-foreground-muted">{p.lesson.outcome}</p>
                                    {!p.done && p.missingPrereqs.length > 0 && (
                                        <p className="mt-1 text-2xs text-faint">
                                            Worth doing first: {p.missingPrereqs.map((l) => l.title).join(', ')}
                                        </p>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </section>
                );
            })}
        </PageShell>
    );
}
