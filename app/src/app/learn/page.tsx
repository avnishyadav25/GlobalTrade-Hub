'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageShell, Panel, Badge, Button, ConfirmDialog, Input, SegmentedControl } from '@/components/ui';
import { TRACKS, LEVELS, type Level } from '@/lib/learn/types';
import { useCourseProgress } from '@/lib/learn/progress';
import { useLearnStore } from '@/stores/learnStore';
import { usePaperStore } from '@/stores/paperStore';

export default function LearnPage() {
    const router = useRouter();
    const progress = useCourseProgress();
    const guideEnabled = useLearnStore((s) => s.guideEnabled);
    const setGuideEnabled = useLearnStore((s) => s.setGuideEnabled);
    const resetProgress = useLearnStore((s) => s.resetProgress);
    const resetPaper = usePaperStore((s) => s.reset);

    const [confirming, setConfirming] = useState(false);
    const [alsoResetPaper, setAlsoResetPaper] = useState(false);
    const [level, setLevel] = useState<Level | 'all'>('all');
    const [query, setQuery] = useState('');

    const pct = progress.total ? Math.round((progress.doneCount / progress.total) * 100) : 0;
    const next = progress.next;
    const liveVerified = progress.lessons.filter((p) => p.result.done).length;

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        return progress.lessons.filter((p) => {
            if (level !== 'all' && p.lesson.level !== level) return false;
            if (!q) return true;
            return (
                p.lesson.title.toLowerCase().includes(q) ||
                p.lesson.outcome.toLowerCase().includes(q) ||
                p.lesson.concept.join(' ').toLowerCase().includes(q)
            );
        });
    }, [progress.lessons, level, query]);

    const filtering = level !== 'all' || query.trim().length > 0;

    const doReset = () => {
        if (alsoResetPaper) resetPaper();
        resetProgress();
        setConfirming(false);
        setAlsoResetPaper(false);
        toast.success('Learning progress reset', {
            description: alsoResetPaper
                ? 'Lessons, quiz answers and your paper account are all back to the start.'
                : liveVerified > 0
                  ? `${liveVerified} lesson${liveVerified === 1 ? '' : 's'} will show as complete again — your trades still satisfy them.`
                  : 'Every lesson is back to the start.',
        });
    };

    return (
        <PageShell
            coachTopic="learn"
            title="Learn to trade"
            subtitle="Fifteen subjects, four levels. Practice lessons are checked against your real paper account; study lessons are checked by questions on real figures."
            actions={next ? <Button variant="primary" onClick={() => router.push(`/learn/${next.lesson.slug}`)}>Continue</Button> : undefined}
        >
            <Panel className="mb-6">
                <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{progress.doneCount} of {progress.total} complete</span>
                    <span className="mono text-sm text-accent">{pct}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
                    <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border2 pt-3">
                    <label className="flex items-center gap-2 text-xs text-foreground-muted">
                        <input type="checkbox" checked={guideEnabled} onChange={(e) => setGuideEnabled(e.target.checked)} className="accent-[color:var(--accent)]" />
                        Show the step-by-step guide while I use the app
                    </label>
                    <button onClick={() => setConfirming(true)} className="text-xs text-faint underline underline-offset-2 hover:text-down">
                        Reset progress
                    </button>
                </div>
            </Panel>

            <div className="mb-5 flex flex-wrap items-center gap-3">
                <SegmentedControl
                    label="Level"
                    size="sm"
                    value={level}
                    onChange={setLevel}
                    options={[{ value: 'all', label: 'All levels' }, ...LEVELS.map((l) => ({ value: l.key, label: l.title }))]}
                />
                <div className="min-w-[200px] flex-1">
                    <Input placeholder="Search lessons…" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
            </div>

            {filtering ? (
                <section>
                    <p className="mb-3 text-xs text-faint">{matches.length} matching lesson{matches.length === 1 ? '' : 's'}</p>
                    <div className="flex flex-col gap-2">
                        {matches.map((p) => (
                            <Link key={p.lesson.slug} href={`/learn/${p.lesson.slug}`} className="panel block p-3.5 transition-colors hover:border-accent">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold">{p.lesson.title}</span>
                                    <Badge tone={p.done ? 'up' : 'neutral'}>{p.done ? 'Done' : `${p.lesson.minutes} min`}</Badge>
                                    <Badge>{p.lesson.level}</Badge>
                                    <Badge tone={p.lesson.kind === 'practice' ? 'accent' : 'neutral'}>{p.lesson.kind}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-foreground-muted">{p.lesson.outcome}</p>
                            </Link>
                        ))}
                        {matches.length === 0 && <p className="text-sm text-faint">Nothing matches that.</p>}
                    </div>
                </section>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {[...TRACKS].sort((a, b) => a.order - b.order).map((track) => {
                        const lessons = progress.lessons.filter((p) => p.lesson.track === track.id);
                        if (!lessons.length) return null;
                        const done = lessons.filter((p) => p.done).length;
                        const trackPct = Math.round((done / lessons.length) * 100);

                        return (
                            <Link key={track.id} href={`/learn/track/${track.id}`} className="panel block p-4 transition-colors hover:border-accent">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-semibold">{track.title}</h2>
                                        <p className="mt-0.5 text-xs text-foreground-muted">{track.blurb}</p>
                                    </div>
                                    <span className="mono shrink-0 text-xs text-faint">{done}/{lessons.length}</span>
                                </div>
                                <div className="mt-3 h-1 overflow-hidden rounded-full bg-chip">
                                    <div className="h-full rounded-full bg-accent" style={{ width: `${trackPct}%` }} />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            <ConfirmDialog
                open={confirming}
                danger
                title="Reset your learning progress?"
                confirmLabel={alsoResetPaper ? 'Reset lessons and account' : 'Reset lessons'}
                onConfirm={doReset}
                onCancel={() => { setConfirming(false); setAlsoResetPaper(false); }}
                body={
                    <div className="flex flex-col gap-3 text-sm">
                        <p>
                            Clears your completed lessons, quiz answers, skipped lessons and dismissed help panels,
                            and forgets which instruments you have looked at.
                        </p>
                        {liveVerified > 0 && (
                            <p className="rounded-sm border border-border2 bg-panel2 p-2.5 text-xs text-foreground-muted">
                                <strong className="text-foreground">{liveVerified} of these {progress.total} lessons will go straight back to complete.</strong>{' '}
                                Their exercises are checked against your paper account, not a stored tick — and your
                                trades still satisfy them. That is the point of the course, so it is not a bug you
                                can reset away.
                            </p>
                        )}
                        <label className="flex items-start gap-2 rounded-sm border border-down/40 bg-down-dim p-2.5 text-xs">
                            <input type="checkbox" checked={alsoResetPaper} onChange={(e) => setAlsoResetPaper(e.target.checked)} className="mt-0.5 accent-[color:var(--down)]" />
                            <span>
                                <strong className="text-foreground">Also reset my paper account.</strong> Wipes every position,
                                order and fill, and returns the balance to the starting cash. This is the only way to make
                                the verified lessons incomplete again — and it cannot be undone.
                            </span>
                        </label>
                    </div>
                }
            />
        </PageShell>
    );
}
