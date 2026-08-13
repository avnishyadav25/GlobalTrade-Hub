/**
 * Every animated explainer a lesson can point at.
 *
 * THIS FILE IS THE SINGLE SOURCE. It lives apart from the React components so the
 * curriculum test can validate `lesson.visual` without importing a client component —
 * and `anim/index.tsx` now builds its registry FROM this list rather than keeping a
 * parallel one. That parallel list was a real hazard: a key added here without a
 * component gave a silently blank lesson and a green test, which is exactly the kind
 * of quiet failure that survives review.
 */

/** Bespoke explainers — one component each, for ideas that need their own picture. */
export const BESPOKE_KEYS = [
    'candle-anatomy',
    'order-types',
    'long-vs-short',
    'slippage-fees',
    'fx-conversion',
    'rsi-gauge',
    'equity-drawdown',
    'risk-sizing',
    'token-vesting',
    'three-statements',
    'option-payoff',
    'greeks',
    'futures-curve',
    'yield-curve',
    'compounding',
    'order-book',
] as const;

/**
 * Parameterised archetypes.
 *
 * A lesson supplies its own labels and numbers, so one component serves many lessons
 * with a genuinely different diagram each time. This is what makes a visual on every
 * lesson possible without either 95 near-duplicate components or 95 pieces of filler.
 */
export const ARCHETYPE_KINDS = [
    'two-series',
    'waterfall',
    'timeline',
    'ladder',
    'gauge',
    'flow',
    'decay',
    'split-bar',
    'cycle',
    'scatter',
    'nested',
    'stack',
    'counter',
] as const;

export type BespokeKey = (typeof BESPOKE_KEYS)[number];
export type ArchetypeKind = (typeof ARCHETYPE_KINDS)[number];

/** A step in a timeline, flow or cycle archetype. */
export interface VisualStep {
    label: string;
    note?: string;
    /** Rendered in the up/down/warn/accent palette. Omit to default to accent. */
    tone?: 'up' | 'down' | 'warn' | 'accent';
    /** Magnitude, for the archetypes that draw one. */
    value?: number;
}

/** What a lesson passes to an archetype. */
export interface ArchetypeConfig {
    kind: ArchetypeKind;
    caption: string;
    /** Axis or series labels, meaning varies by archetype. */
    a?: string;
    b?: string;
    steps?: VisualStep[];
    /** Numeric series, for two-series and scatter. */
    seriesA?: number[];
    seriesB?: number[];
    /** A single 0..1 reading, for gauge and counter. */
    value?: number;
    unit?: string;
}

/** A lesson's `visual` is either a bespoke key or a configured archetype. */
export type LessonVisualSpec = BespokeKey | ArchetypeConfig;

export const VISUAL_KEYS = BESPOKE_KEYS;
export type VisualKey = BespokeKey;

/** True when a spec names a bespoke component rather than configuring an archetype. */
export function isBespoke(v: LessonVisualSpec): v is BespokeKey {
    return typeof v === 'string';
}
