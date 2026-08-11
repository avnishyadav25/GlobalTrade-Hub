/**
 * Keys of the animated explainers in components/learn/anim.
 *
 * Kept in a plain module so the curriculum integrity test can check every
 * `lesson.visual` resolves without importing a React client component.
 */
export const VISUAL_KEYS = [
    'candle-anatomy',
    'order-types',
    'long-vs-short',
    'slippage-fees',
    'fx-conversion',
    'rsi-gauge',
    'equity-drawdown',
    'risk-sizing',
    'token-vesting',
] as const;

export type VisualKey = (typeof VISUAL_KEYS)[number];
