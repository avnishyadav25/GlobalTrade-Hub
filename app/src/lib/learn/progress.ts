'use client';

import { useMemo } from 'react';
import { usePaperStore } from '@/stores/paperStore';
import { useMarketStore } from '@/stores/marketStore';
import { useLearnStore } from '@/stores/learnStore';
import { rsi as seriesRsi } from '@/stores/seriesStore';
import { LESSONS } from './curriculum';
import type { Lesson, VerifyContext, VerifyResult } from './types';

/**
 * The single source of the verification context.
 *
 * PERFORMANCE NOTE, and the reason this is memoised rather than assembled inline:
 * /learn used to build this on every render and run all ten verifiers twice, each
 * calling equity() and deriveFxRates(). Coach marks and the guide bar make verifiers
 * run on EVERY page, so an unmemoised context would be a real cost.
 *
 * `quotes` is read through getState() and deliberately left out of the dependency
 * list. Quotes change once a second; every verifier compares a PAST fill against
 * current equity, where a one-tick-stale quote cannot change the answer. Including
 * them would rebuild the context — and re-run every verifier — at 1 Hz app-wide.
 */
export function useVerifyContext(): VerifyContext {
    const state = usePaperStore((s) => s.state);
    const observedSymbols = useLearnStore((s) => s.observedSymbols);
    const observedMarkets = useLearnStore((s) => s.observedMarkets);

    return useMemo(
        () => ({
            state,
            quotes: useMarketStore.getState().quotes,
            observed: { symbols: observedSymbols, markets: observedMarkets },
            rsi: (symbol: string) => seriesRsi(symbol),
        }),
        [state, observedSymbols, observedMarkets]
    );
}

export interface LessonProgress {
    lesson: Lesson;
    result: VerifyResult;
    /** Verified by the engine, or previously recorded as complete. */
    done: boolean;
    skipped: boolean;
    /** Soft prerequisites that are not done yet. Never blocks. */
    missingPrereqs: Lesson[];
}

export interface CourseProgress {
    lessons: LessonProgress[];
    byslug: Record<string, LessonProgress>;
    doneCount: number;
    total: number;
    /** First lesson that is neither complete nor skipped. */
    next: LessonProgress | null;
}

/**
 * Runs every verifier ONCE and shares the result.
 *
 * /learn previously ran all ten verifiers twice per render, unmemoised. Coach marks
 * and the guide bar put verifiers on every page, so this is the difference between
 * cheap and a permanent tax.
 */
export function useCourseProgress(): CourseProgress {
    const ctx = useVerifyContext();
    const completed = useLearnStore((s) => s.completed);
    const skipped = useLearnStore((s) => s.skipped);

    return useMemo(() => {
        const lessons: LessonProgress[] = LESSONS.map((lesson) => {
            const result = lesson.exercise.verify(ctx);
            return {
                lesson,
                result,
                done: result.done || Boolean(completed[lesson.slug]),
                skipped: Boolean(skipped[lesson.slug]),
                missingPrereqs: [],
            };
        });

        const byslug: Record<string, LessonProgress> = {};
        for (const p of lessons) byslug[p.lesson.slug] = p;

        // Second pass so prerequisite lookups can see every lesson's done state.
        for (const p of lessons) {
            p.missingPrereqs = (p.lesson.prereq ?? [])
                .map((slug) => byslug[slug])
                .filter((dep): dep is LessonProgress => Boolean(dep) && !dep.done)
                .map((dep) => dep.lesson);
        }

        return {
            lessons,
            byslug,
            doneCount: lessons.filter((p) => p.done).length,
            total: lessons.length,
            next: lessons.find((p) => !p.done && !p.skipped) ?? null,
        };
    }, [ctx, completed, skipped]);
}

/**
 * The single definition of "next lesson": the first that is neither complete nor
 * skipped. /learn and /learn/[slug] previously each defined this inline, and
 * differently — one meant "first incomplete", the other "next in the array".
 */
export function nextLesson(progress: CourseProgress): Lesson | null {
    return progress.next?.lesson ?? null;
}

/** The lesson that follows this one in course order, complete or not. */
export function lessonAfter(slug: string): Lesson | null {
    const i = LESSONS.findIndex((l) => l.slug === slug);
    return i >= 0 && i + 1 < LESSONS.length ? LESSONS[i + 1] : null;
}
