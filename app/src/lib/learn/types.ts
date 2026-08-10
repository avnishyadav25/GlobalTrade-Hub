import type { PaperState } from '@/lib/paperEngine';
import type { LiveQuote } from '@/stores/marketStore';

export interface VerifyContext {
    state: PaperState;
    quotes: Record<string, LiveQuote>;
    /** Symbols/markets the user has actually looked at. */
    observed: { symbols: string[]; markets: string[] };
}

export interface VerifyResult {
    done: boolean;
    /** 0..1 for a progress bar, when the exercise has natural steps. */
    progress?: number;
    /** What is still missing, in plain language. */
    hint: string;
}

export interface Exercise {
    title: string;
    body: string;
    verify: (ctx: VerifyContext) => VerifyResult;
}

export interface Quiz {
    question: string;
    options: string[];
    answer: number;
    why: string;
}

export interface Lesson {
    slug: string;
    title: string;
    minutes: number;
    /** One-line promise of what you'll be able to do afterwards. */
    outcome: string;
    concept: string[];
    /** Where in this app the concept lives. */
    inApp: string;
    exercise: Exercise;
    quiz: Quiz[];
}
