import type { PaperState } from '@/lib/paperEngine';
import type { LiveQuote } from '@/stores/marketStore';

export interface VerifyContext {
    state: PaperState;
    quotes: Record<string, LiveQuote>;
    /** Symbols/markets the user has actually looked at. */
    observed: { symbols: string[]; markets: string[] };
    /** Rolling RSI, or null while the indicator is still warming up. */
    rsi: (symbol: string) => number | null;
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

/** Course sections. Order here is the order shown on /learn. */
export type LessonModule = 'foundations' | 'orders' | 'risk' | 'reading' | 'professional';

export const MODULES: { key: LessonModule; title: string; blurb: string }[] = [
    { key: 'foundations', title: 'Foundations', blurb: 'What you are looking at, and what the numbers mean.' },
    { key: 'orders', title: 'Placing orders', blurb: 'How to actually buy and sell, and what it costs.' },
    { key: 'risk', title: 'Managing risk', blurb: 'Deciding what you can lose before you can lose it.' },
    { key: 'reading', title: 'Reading the market', blurb: 'Charts and indicators — what they do and do not tell you.' },
    { key: 'professional', title: 'Trading like a professional', blurb: 'Process, discipline, and going live safely.' },
];

/** A formula, rendered with the reader's own numbers substituted in. */
export interface Formula {
    label: string;
    /** The expression itself, in plain text. */
    expr: string;
    terms: { sym: string; meaning: string }[];
    /** The same formula with real values from this account. Null when not applicable. */
    worked?: (ctx: VerifyContext) => string | null;
}

/** Outside reading. URLs are checked before shipping; dead ones are dropped. */
export interface Resource {
    kind: 'book' | 'video' | 'article' | 'tool';
    title: string;
    by?: string;
    /** Optional: a book needs no link, and a link that rots is worse than none. */
    url?: string;
    /** Why this one, specifically. */
    why: string;
}

/**
 * A repeatable practice task, counted straight from engine state.
 *
 * `count` returns how many times the condition is currently satisfied rather than
 * incrementing a stored tally — so there is no double-counting to get wrong, and no
 * way to tick it off without doing it.
 */
export interface Drill {
    id: string;
    title: string;
    body: string;
    target: number;
    count: (ctx: VerifyContext) => number;
}

export interface Lesson {
    slug: string;
    title: string;
    module: LessonModule;
    minutes: number;
    /** One-line promise of what you'll be able to do afterwards. */
    outcome: string;
    concept: string[];
    /** Where in this app the concept lives. */
    inApp: string;
    /** The screen to go and practise on — powers the guide bar's "Take me there". */
    where: { href: string; label: string };
    /** SOFT prerequisites: shown as guidance, never used to lock a lesson. */
    prereq?: string[];
    /** Key into components/learn/anim — an animated explainer. */
    visual?: string;
    formulas?: Formula[];
    exercise: Exercise;
    drills?: Drill[];
    quiz: Quiz[];
    resources?: Resource[];
}
