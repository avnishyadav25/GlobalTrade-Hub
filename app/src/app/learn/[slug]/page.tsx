'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell, Panel, Badge, Button, Callout } from '@/components/ui';
import { LESSONS, lessonBySlug } from '@/lib/learn/curriculum';
import { TRACKS, LEVELS } from '@/lib/learn/types';
import { useCourseProgress, useVerifyContext, lessonAfter, verifyLesson } from '@/lib/learn/progress';
import { Rich } from '@/lib/learn/render';
import { LessonVisual } from '@/components/learn/anim';
import { FormulaCard } from '@/components/learn/FormulaCard';
import { useLearnStore } from '@/stores/learnStore';

const KIND_LABEL: Record<string, string> = {
    book: 'Book', video: 'Video', article: 'Read', tool: 'Tool',
    regulator: 'Official', course: 'Course', dataset: 'Data',
};

/**
 * Stable empty array. Returning a fresh `[]` from a zustand selector makes
 * useSyncExternalStore re-render forever — the bug that once hung /alerts.
 */
const NO_ANSWERS: number[] = [];

export default function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const lesson = lessonBySlug(slug);

    const ctx = useVerifyContext();
    const progress = useCourseProgress();
    const completed = useLearnStore((s) => s.completed);
    const complete = useLearnStore((s) => s.complete);
    const quizAnswers = useLearnStore((s) => s.quizAnswers[slug]) ?? NO_ANSWERS;
    const answerQuiz = useLearnStore((s) => s.answerQuiz);

    const result = lesson ? verifyLesson(lesson, ctx, quizAnswers) : undefined;
    const isDone = Boolean(result?.done);

    // In an effect, not during render — recording completion while rendering was a
    // real bug here once.
    useEffect(() => {
        if (isDone && !completed[slug]) complete(slug);
    }, [isDone, completed, slug, complete]);

    if (!lesson || !result) notFound();

    const index = LESSONS.findIndex((l) => l.slug === slug);
    const trackInfo = TRACKS.find((t) => t.id === lesson.track);
    const levelInfo = LEVELS.find((l) => l.key === lesson.level);
    const next = lessonAfter(slug);
    const missing = progress.byslug[slug]?.missingPrereqs ?? [];

    return (
        <PageShell width="narrow" title={lesson.title} subtitle={lesson.outcome}>
            <div className="mb-5 flex flex-wrap items-center gap-2">
                <Badge>{trackInfo?.title ?? 'Lesson'}</Badge>
                <Badge>{levelInfo?.title ?? lesson.level}</Badge>
                <Badge tone={lesson.kind === 'practice' ? 'accent' : 'neutral'}>{lesson.kind}</Badge>
                <Badge>{lesson.minutes} min</Badge>
                {isDone && <Badge tone="up">Complete</Badge>}
            </div>

            {missing.length > 0 && (
                <Callout tone="neutral">
                    This builds on{' '}
                    {missing.map((l, i) => (
                        <span key={l.slug}>
                            {i > 0 && ', '}
                            <Link href={`/learn/${l.slug}`} className="text-accent underline underline-offset-2">
                                {l.title}
                            </Link>
                        </span>
                    ))}
                    . You can carry on regardless — nothing is locked.
                </Callout>
            )}

            <Panel title="The idea" className="mt-5">
                <Rich text={lesson.concept.join('\n\n')} className="text-base leading-relaxed text-foreground-muted" />
            </Panel>

            {lesson.visual && (
                <div className="mt-5">
                    <LessonVisual spec={lesson.visual} />
                </div>
            )}

            {lesson.formulas && lesson.formulas.length > 0 && (
                <Panel title="The arithmetic" className="mt-5">
                    <div className="flex flex-col gap-3">
                        {lesson.formulas.map((f) => (
                            <FormulaCard key={f.label} formula={f} ctx={ctx} />
                        ))}
                    </div>
                </Panel>
            )}

            <Panel title="Where it lives in this app" className="mt-5">
                <Rich text={lesson.inApp} className="text-base text-foreground-muted" />
                <Link
                    href={lesson.where.href}
                    className="mt-3 inline-block rounded-sm bg-accent px-3 py-1.5 text-sm font-semibold text-[color:var(--cp-text)] hover:opacity-90"
                >
                    {lesson.where.label} →
                </Link>
            </Panel>

            {lesson.exercise ? (
            <Panel title={`Exercise — ${lesson.exercise.title}`} className="mt-5">
                <Rich text={lesson.exercise.body} className="text-base text-foreground-muted" />

                <div className={`mt-3 rounded-sm p-3 text-sm ${isDone ? 'bg-up-dim text-up' : 'bg-chip text-foreground-muted'}`}>
                    {isDone ? '✓ ' : ''}
                    {result.hint}
                </div>

                {!isDone && result.progress != null && result.progress > 0 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(result.progress * 100)}%` }} />
                    </div>
                )}
            </Panel>
            ) : (
                <Panel title="How this lesson is checked" className="mt-5">
                    <p className="text-sm text-foreground-muted">
                        This is a <strong>study</strong> lesson. There is no way to verify that you understand a
                        balance sheet by reading your trading history, so it is checked by the questions below —
                        every one has to be right. That is a weaker guarantee than a practice lesson, and it is
                        still a check rather than a button.
                    </p>
                    <div className={`mt-3 rounded-sm p-3 text-sm ${isDone ? 'bg-up-dim text-up' : 'bg-chip text-foreground-muted'}`}>
                        {isDone ? '✓ ' : ''}{result.hint}
                    </div>
                </Panel>
            )}

            {lesson.drills && lesson.drills.length > 0 && (
                <Panel title="Practice drills" className="mt-5">
                    <p className="mb-3 text-sm text-faint">
                        Repeatable, and counted from your account — there is nothing to tick off.
                    </p>
                    <div className="flex flex-col gap-3">
                        {lesson.drills.map((d) => {
                            const count = Math.min(d.count(ctx), d.target);
                            const complete = count >= d.target;
                            return (
                                <div key={d.id} className="rounded-sm border border-border2 bg-panel2 p-3">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <h4 className="text-sm font-semibold">{d.title}</h4>
                                        <span className={`mono shrink-0 text-xs ${complete ? 'text-up' : 'text-faint'}`}>
                                            {count}/{d.target}
                                        </span>
                                    </div>
                                    <Rich text={d.body} className="mt-1 text-xs text-foreground-muted" />
                                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-chip">
                                        <div
                                            className={`h-full rounded-full ${complete ? 'bg-up' : 'bg-accent'}`}
                                            style={{ width: `${(count / d.target) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Panel>
            )}

            <Panel title="Check yourself" className="mt-5">
                {lesson.quiz.map((q, qi) => {
                    const chosen = quizAnswers[qi];
                    const answered = chosen != null;
                    return (
                        <div key={qi} className={qi > 0 ? 'mt-5 border-t border-border2 pt-5' : ''}>
                            <p className="text-sm font-semibold">{q.question}</p>
                            <div className="mt-2 flex flex-col gap-1.5">
                                {q.options.map((opt, oi) => {
                                    const isChosen = chosen === oi;
                                    const isRight = oi === q.answer;
                                    const tone = !answered
                                        ? 'border-border hover:border-accent'
                                        : isRight
                                          ? 'border-up bg-up-dim'
                                          : isChosen
                                            ? 'border-down bg-down-dim'
                                            : 'border-border2 opacity-60';
                                    return (
                                        <button
                                            key={oi}
                                            onClick={() => answerQuiz(slug, qi, oi)}
                                            disabled={answered}
                                            className={`rounded-sm border px-3 py-2 text-left text-sm transition-colors ${tone}`}
                                        >
                                            {opt}
                                        </button>
                                    );
                                })}
                            </div>
                            {answered && <Rich text={q.why} className="mt-2 text-xs text-faint" />}
                        </div>
                    );
                })}
            </Panel>

            {lesson.resources && lesson.resources.length > 0 && (
                <Panel title="Go deeper" className="mt-5">
                    <div className="flex flex-col gap-2.5">
                        {lesson.resources.map((r) => {
                            const inner = (
                                <>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge>{KIND_LABEL[r.kind] ?? r.kind}</Badge>
                                        <span className="text-sm font-semibold">{r.title}</span>
                                        {r.by && <span className="text-xs text-faint">{r.by}</span>}
                                    </div>
                                    <p className="mt-1 text-xs text-foreground-muted">{r.why}</p>
                                </>
                            );
                            return r.url ? (
                                <a
                                    key={r.title}
                                    href={r.url}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="rounded-sm border border-border2 bg-panel2 p-3 transition-colors hover:border-accent"
                                >
                                    {inner}
                                </a>
                            ) : (
                                <div key={r.title} className="rounded-sm border border-border2 bg-panel2 p-3">
                                    {inner}
                                </div>
                            );
                        })}
                    </div>
                </Panel>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
                <Link href="/learn" className="text-sm text-foreground-muted hover:text-foreground">
                    ← All lessons
                </Link>
                {next && (
                    <Link href={`/learn/${next.slug}`}>
                        <Button variant="primary">Next: {next.title} →</Button>
                    </Link>
                )}
            </div>
        </PageShell>
    );
}
