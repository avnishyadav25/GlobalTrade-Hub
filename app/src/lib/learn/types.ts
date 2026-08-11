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

/**
 * Subject tracks. A track is WHAT you are learning about.
 *
 * The original five "modules" were really a single beginner path; at 130 lessons the
 * course needs two axes, because "options" is a subject and "expert" is a depth, and a
 * flat list conflates them.
 */
export type TrackId =
    | 'markets' | 'india-equity' | 'us-equity' | 'company' | 'technical'
    | 'crypto' | 'airdrops' | 'ipo' | 'derivatives' | 'forex'
    | 'commodities' | 'other-markets' | 'strategy' | 'macro' | 'risk';

/** Depth. A track spans several of these. */
export type Level = 'foundation' | 'intermediate' | 'advanced' | 'expert';

export const LEVELS: { key: Level; title: string; blurb: string }[] = [
    { key: 'foundation', title: 'Foundation', blurb: 'No prior knowledge assumed.' },
    { key: 'intermediate', title: 'Intermediate', blurb: 'Builds on the basics.' },
    { key: 'advanced', title: 'Advanced', blurb: 'Mechanics most retail traders never learn.' },
    { key: 'expert', title: 'Expert', blurb: 'The detail that separates a hobby from a process.' },
];

export interface Track {
    id: TrackId;
    title: string;
    blurb: string;
    /** Rough order to work through them in. Nothing is locked. */
    order: number;
}

export const TRACKS: Track[] = [
    { id: 'markets', title: 'Markets and how they work', blurb: 'What a market is, who is in it, and how an order becomes a trade.', order: 1 },
    { id: 'india-equity', title: 'India equity', blurb: 'NSE, BSE and SEBI — the market you are actually trading.', order: 2 },
    { id: 'us-equity', title: 'US equity', blurb: 'NYSE, NASDAQ, and what changes when you invest abroad.', order: 3 },
    { id: 'company', title: 'Reading a company', blurb: 'Financial statements, ratios, and the red flags in an annual report.', order: 4 },
    { id: 'technical', title: 'Technical analysis', blurb: 'Charts and indicators — what they do and do not tell you.', order: 5 },
    { id: 'crypto', title: 'Crypto', blurb: 'Blockchains, exchanges, custody, and Indian tax treatment.', order: 6 },
    { id: 'airdrops', title: 'Airdrops', blurb: 'How token distributions work, and how wallets get drained.', order: 7 },
    { id: 'ipo', title: 'IPOs', blurb: 'Book building, allotment, listing day, and grey market premium.', order: 8 },
    { id: 'derivatives', title: 'Derivatives and options', blurb: 'Futures, the Greeks, and why most retail F&O traders lose.', order: 9 },
    { id: 'forex', title: 'Forex', blurb: 'Currency pairs, carry, and leverage as the real risk.', order: 10 },
    { id: 'commodities', title: 'Commodities', blurb: 'Physical versus financial, and the futures curve.', order: 11 },
    { id: 'other-markets', title: 'Other markets', blurb: 'Bonds, ETFs, index funds, REITs and gold.', order: 12 },
    { id: 'strategy', title: 'Strategy and systems', blurb: 'Turning an idea into rules, and testing it honestly.', order: 13 },
    { id: 'macro', title: 'News, macro and calendars', blurb: 'Rate decisions, inflation prints, and pricing expectations.', order: 14 },
    { id: 'risk', title: 'Risk, psychology and regulation', blurb: 'Ruin, bias, scams, and what protects you.', order: 15 },
];

/**
 * How a lesson is verified.
 *
 * `practice` is checked against persisted engine state — your fills, your orders, your
 * positions. `study` is checked by a quiz on real figures, because there is no way to
 * verify that someone understands a balance sheet from their trading history. The two
 * are badged differently so it is always clear which kind you are looking at.
 */
export type LessonKind = 'practice' | 'study';

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
    kind: 'book' | 'video' | 'article' | 'tool' | 'regulator' | 'course' | 'dataset';
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
    track: TrackId;
    level: Level;
    kind: LessonKind;
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
    /** Required for a `practice` lesson; absent on a `study` lesson. */
    exercise?: Exercise;
    drills?: Drill[];
    quiz: Quiz[];
    resources?: Resource[];
}
