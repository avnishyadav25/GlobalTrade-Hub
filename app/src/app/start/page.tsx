'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { PageShell, Panel, Badge, Callout } from '@/components/ui';
import { Rich } from '@/lib/learn/render';
import { useVerifyContext } from '@/lib/learn/progress';
import { useLearnStore } from '@/stores/learnStore';
import { PROGRAMME, weekProgress, VERIFIED_COUNT, REFLECTIVE_COUNT, type ProgrammeStep } from '@/lib/learn/programme';

// The paper-trading programme.
//
// Five weeks, each building on the last. The screen and docs/PAPER-TRADING-CAREER.md read
// from the same `programme.ts`, so they cannot drift.
//
// TWO KINDS OF STEP, and the difference is deliberately visible. Verified steps are
// predicates over your paper ledger — there is no way to tick one by hand, exactly as
// with the curriculum. Reflective steps (writing your rules down, reading your own
// journal) are self-marked, and are LABELLED as self-marked, because "the engine saw
// this" and "you told me this" are different claims and should never look alike.
//
// Weeks are not locked. A programme that refuses to show you week three is a programme
// that assumes you have not already done it somewhere else.

export default function StartPage() {
    const ctx = useVerifyContext();
    const selfMarked = useLearnStore((s) => s.programmeSteps);
    const toggle = useLearnStore((s) => s.toggleProgrammeStep);

    const marks = useMemo(() => selfMarked ?? {}, [selfMarked]);

    const weeks = useMemo(
        () => PROGRAMME.map((w) => ({ week: w, progress: weekProgress(w, ctx, marks) })),
        [ctx, marks]
    );

    const doneTotal = weeks.reduce((n, w) => n + w.progress.done, 0);
    const allTotal = weeks.reduce((n, w) => n + w.progress.total, 0);
    const pct = allTotal ? Math.round((doneTotal / allTotal) * 100) : 0;
    const current = weeks.find((w) => !w.progress.complete) ?? weeks[weeks.length - 1];

    return (
        <PageShell
            title="Start paper trading"
            subtitle="Five weeks, in order. Most of it is checked against your actual paper account rather than ticked off — and where it cannot be, the step says so."
        >
            <Panel className="mb-6">
                <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{doneTotal} of {allTotal} steps</span>
                    <span className="mono text-sm text-accent">{pct}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
                    <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-3 border-t border-border2 pt-3 text-xs text-faint">
                    <strong className="text-foreground">{VERIFIED_COUNT} steps are verified</strong> against your paper
                    ledger — the engine has to see you do them.{' '}
                    <strong className="text-foreground">{REFLECTIVE_COUNT} are self-marked</strong>, because no ledger can
                    confirm that you wrote your rules down or read your own journal. Those are where most of the value is,
                    which is why they are here rather than omitted for being unmeasurable.
                </p>
            </Panel>

            {current && !current.progress.complete && (
                <Callout tone="accent">
                    You are on <strong>week {current.week.n} — {current.week.title}</strong>. {current.week.aim}
                </Callout>
            )}

            <div className="flex flex-col gap-5">
                {weeks.map(({ week, progress }) => (
                    <Panel key={week.n}>
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border2 pb-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-sm font-semibold">Week {week.n} · {week.title}</h2>
                                    {progress.complete && <Badge tone="up">done</Badge>}
                                </div>
                                <p className="mt-1 max-w-[75ch] text-xs text-foreground-muted">{week.aim}</p>
                            </div>
                            <span className="mono shrink-0 text-xs text-faint">{progress.done}/{progress.total}</span>
                        </div>

                        <p className="mt-3 text-xs" style={{ color: 'var(--warn)' }}>
                            <span className="font-semibold">What goes wrong here: </span>{week.trap}
                        </p>

                        <div className="mt-4 flex flex-col gap-2.5">
                            {week.steps.map((step) => (
                                <Step
                                    key={step.id}
                                    step={step}
                                    done={step.kind === 'verified' ? Boolean(step.verify?.(ctx).done) : Boolean(marks[step.id])}
                                    hint={step.kind === 'verified' ? step.verify?.(ctx).hint : undefined}
                                    onToggle={() => toggle(step.id)}
                                />
                            ))}
                        </div>
                    </Panel>
                ))}
            </div>

            <p className="mt-6 text-xs text-faint">
                The long-form version of this, with the parts that need paragraphs rather than checkboxes, is in{' '}
                <code className="mono rounded-xs bg-chip px-1 py-0.5">docs/PAPER-TRADING-CAREER.md</code>. Both read from
                the same source, so they cannot disagree.
            </p>
        </PageShell>
    );
}

function Step({
    step,
    done,
    hint,
    onToggle,
}: {
    step: ProgrammeStep;
    done: boolean;
    hint?: string;
    onToggle: () => void;
}) {
    const verified = step.kind === 'verified';

    return (
        <div
            className="rounded-sm border p-3 transition-colors"
            style={{ borderColor: done ? 'var(--up)' : 'var(--border2)' }}
        >
            <div className="flex items-start gap-2.5">
                {verified ? (
                    // Deliberately NOT a checkbox. There is nothing to click, because
                    // there is nothing you can do here except go and do the thing.
                    <span
                        aria-hidden
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-2xs"
                        style={{ background: done ? 'var(--up)' : 'var(--chip)', color: done ? 'var(--panel)' : 'var(--faint)' }}
                    >
                        {done ? '✓' : ''}
                    </span>
                ) : (
                    <input
                        type="checkbox"
                        checked={done}
                        onChange={onToggle}
                        aria-label={step.title}
                        className="mt-0.5 shrink-0 accent-[color:var(--accent)]"
                    />
                )}

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{step.title}</span>
                        <Badge tone={verified ? 'accent' : 'neutral'}>
                            {verified ? 'checked against your account' : 'self-marked'}
                        </Badge>
                    </div>

                    <p className="mt-1 max-w-[75ch] text-xs text-foreground-muted">{step.why}</p>

                    {verified && hint && !done && (
                        <Rich text={hint} className="mt-1.5 text-xs text-faint" />
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-3">
                        {step.where && (
                            <Link href={step.where.href} className="text-xs text-accent underline underline-offset-2">
                                {step.where.label} →
                            </Link>
                        )}
                        {step.lesson && (
                            <Link href={`/learn/${step.lesson}`} className="text-xs text-faint underline underline-offset-2 hover:text-foreground">
                                Read the lesson
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
