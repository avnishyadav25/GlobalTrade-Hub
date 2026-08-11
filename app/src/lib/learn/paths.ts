import { lessonBySlug } from './curriculum';
import { libraryItems, type LibraryItem } from './library';
import type { Lesson } from './types';

/**
 * Curated reading paths.
 *
 * A path is an ORDERED mix of lessons in this app and outside resources, aimed at one
 * question. The list of 117 lessons and 30-odd resources answers "what exists"; a path
 * answers "where do I start", which is the question people actually have.
 *
 * Steps referencing a missing slug or library id are dropped at read time rather than
 * rendering a dead row — and there is a test asserting no path is empty, so a typo
 * fails the build instead of quietly shrinking a path.
 */

export interface PathStep {
    /** A lesson slug in this app, or a library item id. */
    ref: string;
    note?: string;
}

export interface ReadingPath {
    id: string;
    title: string;
    blurb: string;
    forWhom: string;
    steps: PathStep[];
}

export const PATHS: ReadingPath[] = [
    {
        id: 'first-trade',
        title: 'Complete beginner to first trade',
        blurb: 'Enough to place an order you understand, and to know what it cost you.',
        forWhom: 'You have never traded and want the mechanics before the opinions.',
        steps: [
            { ref: 'what-you-are-looking-at' },
            { ref: 'price-and-change' },
            { ref: 'nse-bse-and-sebi', note: 'Who holds your shares, and why that protects you.' },
            { ref: 'your-first-order' },
            { ref: 'quantity-and-buying-power' },
            { ref: 'closing-a-trade' },
            { ref: 'fees-and-slippage', note: 'The part almost every beginner skips.' },
            { ref: 'intraday-vs-delivery', note: 'The product choice that changes your tax treatment.' },
            { ref: 'varsity' },
        ],
    },
    {
        id: 'not-getting-scammed',
        title: 'Not getting scammed',
        blurb: 'The structures behind most investment fraud, and the one-minute checks that defeat them.',
        forWhom: 'Anyone. Read this before you read anything about returns.',
        steps: [
            { ref: 'scams-and-frauds', note: 'Start here — the four structures.' },
            { ref: 'how-wallets-get-drained', note: 'Crypto theft does not need your password.' },
            { ref: 'custody-and-keys' },
            { ref: 'grey-market-premium', note: 'An unregulated rumour with a number attached.' },
            { ref: 'fx-in-india', note: 'Why the 500x forex broker advertised to you is not a legal route.' },
            { ref: 'reading-news-critically' },
            { ref: 'sebi-investor', note: 'Verify a registration here, not from a bio.' },
        ],
    },
    {
        id: 'understand-a-company',
        title: 'Understand a company in six reads',
        blurb: 'From the three statements to the red flags, in the order they build.',
        forWhom: 'You want to judge a business rather than a chart.',
        steps: [
            { ref: 'three-statements', note: 'How one credit sale touches all three.' },
            { ref: 'income-statement' },
            { ref: 'balance-sheet' },
            { ref: 'cash-flow-statement', note: 'Profit involves judgement; cash does not.' },
            { ref: 'quality-of-earnings' },
            { ref: 'accounting-red-flags' },
            { ref: 'graham-interpretation' },
            { ref: 'sec-edgar', note: 'For US companies. India has no free equivalent.' },
        ],
    },
    {
        id: 'options-from-zero',
        title: 'Options from zero',
        blurb: 'The full derivatives track in order, ending with the base rate and what this app cannot do.',
        forWhom: 'You are considering F&O. Read the last two before you start, not after.',
        steps: [
            { ref: 'what-a-derivative-is' },
            { ref: 'calls-and-puts', note: 'Which side has unlimited loss.' },
            { ref: 'intrinsic-and-time-value' },
            { ref: 'payoff-diagrams' },
            { ref: 'the-greeks', note: 'Theta is the one always working against a buyer.' },
            { ref: 'implied-volatility', note: 'Why a correct earnings call still loses money.' },
            { ref: 'spreads-and-combinations' },
            { ref: 'expiry-and-assignment', note: 'Indian stock options settle physically.' },
            { ref: 'fno-reality-check', note: 'SEBI\'s own data. Read it before deciding.' },
            { ref: 'hull-derivatives' },
        ],
    },
    {
        id: 'build-a-system',
        title: 'Build a system you can trust',
        blurb: 'Turning a belief into rules, then testing it honestly enough that the result means something.',
        forWhom: 'You want to automate, or to stop trading on feel.',
        steps: [
            { ref: 'hypothesis-to-rules' },
            { ref: 'overfitting', note: 'Five significant results from a hundred tests is what chance predicts.' },
            { ref: 'walk-forward' },
            { ref: 'costs-in-backtests', note: '200 round trips a year is ~16.5% before you are right about anything.' },
            { ref: 'systematic-sizing' },
            { ref: 'correlation-and-concentration' },
            { ref: 'risk-of-ruin' },
            { ref: 'when-to-kill-a-strategy' },
            { ref: 'paper-to-live' },
            { ref: 'aronson-evidence-based-ta' },
            { ref: 'lopez-de-prado-afml' },
        ],
    },
    {
        id: 'crypto-without-losing-it',
        title: 'Crypto without losing it',
        blurb: 'Custody, market structure and the Indian tax regime, before anything about price.',
        forWhom: 'You hold crypto or are about to.',
        steps: [
            { ref: 'what-a-blockchain-settles' },
            { ref: 'custody-and-keys', note: 'Not your keys, not your coins — and what that costs both ways.' },
            { ref: 'how-wallets-get-drained' },
            { ref: 'exchanges-and-liquidity' },
            { ref: 'stablecoins', note: 'One design has already failed at scale.' },
            { ref: 'india-vda-tax', note: 'No loss set-off. This changes what strategies are viable.' },
            { ref: 'evaluating-a-token' },
            { ref: 'crypto-cycles' },
            { ref: 'antonopoulos-mastering-bitcoin' },
        ],
    },
    {
        id: 'investing-not-trading',
        title: 'If you would rather not trade',
        blurb: 'The honest alternative, argued from the arithmetic rather than from modesty.',
        forWhom: 'You are not sure active trading is for you. This is a real answer, not a consolation.',
        steps: [
            { ref: 'etfs-and-index-funds', note: 'The average active rupee must underperform by roughly the fees.' },
            { ref: 'mutual-funds-india', note: 'Direct vs regular is the highest-value decision here.' },
            { ref: 'bonds-basics' },
            { ref: 'asset-allocation' },
            { ref: 'behavioural-biases' },
            { ref: 'bogle-common-sense' },
            { ref: 'housel-psychology' },
            { ref: 'halan-lets-talk-money' },
        ],
    },
];

export interface ResolvedStep {
    ref: string;
    note?: string;
    lesson?: Lesson;
    item?: LibraryItem;
}

/** Resolve a path's steps against the curriculum and the library, dropping unknowns. */
export function resolvePath(path: ReadingPath): ResolvedStep[] {
    // Curated entries keep their short id ('varsity'); lesson-derived ones are keyed
    // by URL. Indexing the merged list by `id` covers both.
    const byId = new Map(libraryItems().map((i) => [i.id, i]));

    return path.steps
        .map((step): ResolvedStep => {
            const lesson = lessonBySlug(step.ref);
            if (lesson) return { ...step, lesson };
            return { ...step, item: byId.get(step.ref) };
        })
        .filter((s) => s.lesson || s.item);
}
