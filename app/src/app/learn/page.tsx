'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageShell, Panel, Badge, Button, ConfirmDialog } from '@/components/ui';
import { MODULES } from '@/lib/learn/types';
import { useCourseProgress } from '@/lib/learn/progress';
import { useLearnStore } from '@/stores/learnStore';
import { usePaperStore } from '@/stores/paperStore';

export default function LearnPage() {
    const router = useRouter();
    const progress = useCourseProgress();
    const guideEnabled = useLearnStore((s) => s.guideEnabled);
    const setGuideEnabled = useLearnStore((s) => s.setGuideEnabled);
    const unskipLesson = useLearnStore((s) => s.unskipLesson);
    const resetProgress = useLearnStore((s) => s.resetProgress);
    const resetPaper = usePaperStore((s) => s.reset);

    const [confirming, setConfirming] = useState(false);
    const [alsoResetPaper, setAlsoResetPaper] = useState(false);

    const pct = progress.total ? Math.round((progress.doneCount / progress.total) * 100) : 0;
    const next = progress.next;

    // Lessons whose exercise passes against the CURRENT paper account. Clearing the
    // stored records cannot un-complete these — they are recomputed on every render —
    // so the dialog says so rather than promising a clean slate it cannot deliver.
    const liveVerified = progress.lessons.filter((p) => p.result.done).length;

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
                  : 'All sixteen lessons are back to the start.',
        });
    };

    return (
        <PageShell
            coachTopic="learn"
            width="narrow"
            title="Learn to trade"
            subtitle="Sixteen lessons, each one checked against your real paper account. Nothing here is marked complete by hand."
            actions={
                next ? (
                    <Button variant="primary" onClick={() => router.push(`/learn/${next.lesson.slug}`)}>
                        Continue
                    </Button>
                ) : undefined
            }
        >
            <Panel className="mb-6">
                <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">
                        {progress.doneCount} of {progress.total} complete
                    </span>
                    <span className="mono text-sm text-accent">{pct}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
                    <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border2 pt-3">
                    <label className="flex items-center gap-2 text-xs text-foreground-muted">
                        <input
                            type="checkbox"
                            checked={guideEnabled}
                            onChange={(e) => setGuideEnabled(e.target.checked)}
                            className="accent-[color:var(--accent)]"
                        />
                        Show the step-by-step guide while I use the app
                    </label>
                    <button
                        onClick={() => setConfirming(true)}
                        className="text-xs text-faint underline underline-offset-2 hover:text-down"
                    >
                        Reset progress
                    </button>
                </div>
            </Panel>

            {MODULES.map((module) => {
                const lessons = progress.lessons.filter((p) => p.lesson.module === module.key);
                if (!lessons.length) return null;
                const done = lessons.filter((p) => p.done).length;

                return (
                    <section key={module.key} className="mb-7">
                        <header className="mb-2.5 flex items-baseline justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="text-md font-semibold">{module.title}</h2>
                                <p className="text-xs text-faint">{module.blurb}</p>
                            </div>
                            <span className="mono shrink-0 text-xs text-faint">
                                {done}/{lessons.length}
                            </span>
                        </header>

                        <div className="flex flex-col gap-2">
                            {lessons.map((p) => {
                                const n = progress.lessons.indexOf(p) + 1;
                                return (
                                    <Link
                                        key={p.lesson.slug}
                                        href={`/learn/${p.lesson.slug}`}
                                        className="panel block p-3.5 transition-colors hover:border-accent"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="mono text-xs text-faint">{String(n).padStart(2, '0')}</span>
                                                    <span className="text-sm font-semibold">{p.lesson.title}</span>
                                                    <Badge tone={p.done ? 'up' : 'neutral'}>{p.done ? 'Done' : `${p.lesson.minutes} min`}</Badge>
                                                    {p.skipped && !p.done && <Badge tone="warn">Skipped</Badge>}
                                                </div>
                                                <p className="mt-1 text-xs text-foreground-muted">{p.lesson.outcome}</p>
                                                {!p.done && p.missingPrereqs.length > 0 && (
                                                    <p className="mt-1 text-2xs text-faint">
                                                        Worth doing first: {p.missingPrereqs.map((l) => l.title).join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                            {p.skipped && !p.done && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        unskipLesson(p.lesson.slug);
                                                    }}
                                                    className="shrink-0 text-2xs text-faint hover:text-foreground"
                                                >
                                                    Unskip
                                                </button>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                );
            })}

            <ConfirmDialog
                open={confirming}
                danger
                title="Reset your learning progress?"
                confirmLabel={alsoResetPaper ? 'Reset lessons and account' : 'Reset lessons'}
                onConfirm={doReset}
                onCancel={() => {
                    setConfirming(false);
                    setAlsoResetPaper(false);
                }}
                body={
                    <div className="flex flex-col gap-3 text-sm">
                        <p>
                            Clears your completed lessons, quiz answers, skipped lessons and dismissed help
                            panels, and forgets which instruments you have looked at.
                        </p>

                        {liveVerified > 0 && (
                            <p className="rounded-sm border border-border2 bg-panel2 p-2.5 text-xs text-foreground-muted">
                                <strong className="text-foreground">
                                    {liveVerified} of these {progress.total} lessons will go straight back to complete.
                                </strong>{' '}
                                Their exercises are checked against your paper account, not a stored tick — and
                                your trades still satisfy them. That is the point of the course, so it is not a
                                bug you can reset away.
                            </p>
                        )}

                        <label className="flex items-start gap-2 rounded-sm border border-down/40 bg-down-dim p-2.5 text-xs">
                            <input
                                type="checkbox"
                                checked={alsoResetPaper}
                                onChange={(e) => setAlsoResetPaper(e.target.checked)}
                                className="mt-0.5 accent-[color:var(--down)]"
                            />
                            <span>
                                <strong className="text-foreground">Also reset my paper account.</strong> Wipes every
                                position, order and fill, and returns the balance to the starting cash. This is the
                                only way to make the verified lessons incomplete again — and it cannot be undone.
                            </span>
                        </label>
                    </div>
                }
            />
        </PageShell>
    );
}
