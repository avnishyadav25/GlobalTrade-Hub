'use client';

import { useMemo } from 'react';
import { usePaperStore } from '@/stores/paperStore';
import { useMarketStore } from '@/stores/marketStore';
import { useLearnStore } from '@/stores/learnStore';
import { rsi as seriesRsi } from '@/stores/seriesStore';
import { LESSONS } from './curriculum';
import type { Lesson, Quiz, VerifyContext, VerifyResult } from './types';

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

/**
 * Verify a STUDY lesson from its quiz.
 *
 * There is no way to check that someone understands a balance sheet by reading their
 * trading history, so these are verified by answering every question correctly. It is a
 * weaker guarantee than a practice lesson and the UI says so — but it is still a check,
 * not a "mark as done" button.
 */
export function verifyByQuiz(quiz: Quiz[], answers: number[] = []): VerifyResult {
    const total = quiz.length;
    if (total === 0) return { done: false, hint: 'This lesson has no questions yet.' };
    const correct = quiz.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
    if (correct === total) return { done: true, progress: 1, hint: `All ${total} questions correct.` };
    return {
        done: false,
        progress: correct / total,
        hint: `${correct} of ${total} correct. Answer the rest — a wrong answer explains itself.`,
    };
}

/** One entry point, whichever kind of lesson it is. */
export function verifyLesson(lesson: Lesson, ctx: VerifyContext, answers: number[] = []): VerifyResult {
    if (lesson.kind === 'study' || !lesson.exercise) return verifyByQuiz(lesson.quiz, answers);
    return lesson.exercise.verify(ctx);
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
    const quizAnswers = useLearnStore((s) => s.quizAnswers);

    return useMemo(() => {
        const lessons: LessonProgress[] = LESSONS.map((lesson) => {
            const result = verifyLesson(lesson, ctx, quizAnswers[lesson.slug]);
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
    }, [ctx, completed, skipped, quizAnswers]);
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
