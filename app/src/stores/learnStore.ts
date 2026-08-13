'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LearnStore {
    completed: Record<string, number>;
    /** Instruments and markets the user has actually opened — feeds lessons 1 and 2. */
    observedSymbols: string[];
    observedMarkets: string[];
    seenCoachMarks: Record<string, number>;
    /** Lessons explicitly skipped from the guide bar. Slug -> when. */
    skipped: Record<string, number>;
    /** Quiz answers, so they survive navigation. Slug -> index per question. */
    quizAnswers: Record<string, number[]>;
    /**
     * Self-marked programme steps — the reflective ones no ledger can confirm.
     * Step id -> when. Verified steps are NEVER stored here; they are recomputed from
     * the paper ledger every render, which is what stops the programme becoming a
     * checklist you can tick without doing anything.
     */
    programmeSteps: Record<string, number>;
    /** Guide-bar state. */
    guideEnabled: boolean;
    guideCollapsed: boolean;
    /**
     * Monotonic revision. cloudSync uses it as an `isNewer` guard: without one, a
     * stale server row overwrites newer local progress and dismissed coach marks
     * reappear. `paper` has had this via `seq`; `learn` did not.
     */
    rev: number;

    observe: (symbol: string, market: string) => void;
    complete: (slug: string) => void;
    markCoachSeen: (topic: string) => void;
    skipLesson: (slug: string) => void;
    unskipLesson: (slug: string) => void;
    answerQuiz: (slug: string, question: number, choice: number) => void;
    setGuideEnabled: (enabled: boolean) => void;
    setGuideCollapsed: (collapsed: boolean) => void;
    /**
     * Clears everything this store records. It CANNOT un-complete a lesson whose
     * exercise is verified live from the paper account — `done` is
     * `verify(state) || completed[slug]`, so those reappear immediately. Resetting
     * the paper account is the other half, and is deliberately a separate action.
     */
    toggleProgrammeStep: (id: string) => void;
    resetProgress: () => void;
}

export const useLearnStore = create<LearnStore>()(
    persist(
        (set) => ({
            completed: {},
            observedSymbols: [],
            observedMarkets: [],
            seenCoachMarks: {},
            skipped: {},
            quizAnswers: {},
            programmeSteps: {},
            guideEnabled: true,
            guideCollapsed: false,
            rev: 0,

            observe: (symbol, market) =>
                set((s) =>
                    s.observedSymbols.includes(symbol)
                        ? s
                        : {
                              observedSymbols: [...s.observedSymbols, symbol].slice(-50),
                              observedMarkets: s.observedMarkets.includes(market) ? s.observedMarkets : [...s.observedMarkets, market],
                              rev: s.rev + 1,
                          }
                ),

            complete: (slug) =>
                set((s) => (s.completed[slug] ? s : { completed: { ...s.completed, [slug]: Date.now() }, rev: s.rev + 1 })),

            markCoachSeen: (topic) =>
                set((s) =>
                    s.seenCoachMarks[topic]
                        ? s
                        : { seenCoachMarks: { ...s.seenCoachMarks, [topic]: Date.now() }, rev: s.rev + 1 }
                ),

            toggleProgrammeStep: (id) =>
                set((s) => {
                    const next = { ...(s.programmeSteps ?? {}) };
                    if (next[id]) delete next[id];
                    else next[id] = Date.now();
                    return { programmeSteps: next, rev: s.rev + 1 };
                }),

            skipLesson: (slug) => set((s) => ({ skipped: { ...s.skipped, [slug]: Date.now() }, rev: s.rev + 1 })),

            unskipLesson: (slug) =>
                set((s) => {
                    if (!s.skipped[slug]) return s;
                    const skipped = { ...s.skipped };
                    delete skipped[slug];
                    return { skipped, rev: s.rev + 1 };
                }),

            answerQuiz: (slug, question, choice) =>
                set((s) => {
                    const current = [...(s.quizAnswers[slug] ?? [])];
                    current[question] = choice;
                    return { quizAnswers: { ...s.quizAnswers, [slug]: current }, rev: s.rev + 1 };
                }),

            setGuideEnabled: (guideEnabled) => set((s) => ({ guideEnabled, rev: s.rev + 1 })),
            setGuideCollapsed: (guideCollapsed) => set((s) => ({ guideCollapsed, rev: s.rev + 1 })),

            resetProgress: () =>
                set((s) => ({
                    completed: {},
                    observedSymbols: [],
                    observedMarkets: [],
                    seenCoachMarks: {},
                    skipped: {},
                    quizAnswers: {},
                    programmeSteps: {},
                    guideCollapsed: false,
                    // rev must keep climbing, or cloud sync's isNewer guard treats the
                    // server's pre-reset copy as newer and restores what we just cleared.
                    rev: s.rev + 1,
                })),
        }),
        { name: 'gth-learn' }
    )
);
