import * as v from './verify';
import type { VerifyContext, VerifyResult } from './types';

// The paper-trading programme.
//
// ONE SOURCE for both the /start screen and docs/PAPER-TRADING-CAREER.md, so the two
// cannot drift apart. The handbook is the long-form version of exactly these steps.
//
// TWO KINDS OF STEP, and the distinction is deliberately visible in the UI rather than
// blurred:
//
//   verified  — a predicate over your paper ledger, reusing the same helpers the
//               curriculum uses. There is no way to mark one done by hand.
//   reflective — something no ledger can confirm. Writing your rules down, reading your
//               own journal, deciding whether to continue. These are self-marked, and
//               they are labelled as self-marked, because "the engine saw this" and
//               "you told me this" are different claims and should never look alike.
//
// Omitting the reflective steps would have been the stricter choice and the worse one:
// they are where most of the value is, and a programme that only counts what is
// countable quietly teaches that only countable things matter.

export type StepKind = 'verified' | 'reflective';

export interface ProgrammeStep {
    id: string;
    title: string;
    /** Why this step is here. Rendered under the title. */
    why: string;
    kind: StepKind;
    /** Present on every verified step. Absent on reflective ones. */
    verify?: (ctx: VerifyContext) => VerifyResult;
    /** Where to go and do it. */
    where?: { href: string; label: string };
    /** A lesson that covers the idea. */
    lesson?: string;
}

export interface ProgrammeWeek {
    n: number;
    title: string;
    /** What this week is FOR, in one sentence. */
    aim: string;
    /** The thing people get wrong in this week specifically. */
    trap: string;
    steps: ProgrammeStep[];
}

export const PROGRAMME: ProgrammeWeek[] = [
    {
        n: 1,
        title: 'The machine',
        aim: 'Learn what the buttons do, on positions small enough that nothing you learn is expensive.',
        trap: 'Trying to make money in week one. You are learning where the controls are; a profit here teaches you nothing repeatable and a loss teaches you the wrong lesson.',
        steps: [
            {
                id: 'w1-look',
                title: 'Watch three instruments in different markets',
                why: 'A crypto tick, an Indian equity and a currency pair behave nothing alike. Seeing that before trading stops you carrying one market’s habits into another.',
                kind: 'verified',
                verify: v.viewedInstruments(3, 2),
                where: { href: '/terminal', label: 'Open the terminal' },
                lesson: 'what-you-are-looking-at',
            },
            {
                id: 'w1-buy',
                title: 'Place your first market order',
                why: 'The whole loop in one action: choose an instrument, choose a size, and watch what it costs.',
                kind: 'verified',
                verify: v.placedFirstBuy,
                where: { href: '/terminal', label: 'Place an order' },
                lesson: 'your-first-order',
            },
            {
                id: 'w1-close',
                title: 'Close it, and look at what you actually kept',
                why: 'Opening is the easy half. The number that matters appears only when a position is closed, after charges.',
                kind: 'verified',
                verify: v.closedARoundTrip,
                where: { href: '/holdings', label: 'Close a position' },
                lesson: 'closing-a-trade',
            },
            {
                id: 'w1-limit',
                title: 'Rest a limit order that does not fill immediately',
                why: 'A limit that sits unfilled is the point of the exercise. You are buying price certainty with execution uncertainty, and feeling that trade-off is worth more than reading it.',
                kind: 'verified',
                verify: v.restedALimitOrder,
                where: { href: '/terminal', label: 'Place a limit' },
                lesson: 'limit-orders',
            },
            {
                id: 'w1-why',
                title: 'Write down why you took each trade — before you take it',
                why: 'One sentence per trade, written first. This is the only record that cannot be rewritten afterwards, and by month three it is the most valuable thing you own.',
                kind: 'reflective',
                lesson: 'journal-and-discipline',
            },
        ],
    },
    {
        n: 2,
        title: 'What it costs',
        aim: 'Find out what your trading actually costs, before you have an opinion about whether it works.',
        trap: 'Assuming costs are small because each one is small. At 200 round trips a year, 8 basis points is 16% — larger than most edges.',
        steps: [
            {
                id: 'w2-fees',
                title: 'Pay a real charge and read it itemised',
                why: 'Not one blended "fees" line. Brokerage, STT, exchange fee, SEBI fee, stamp duty and GST are different things with different rules, and the differences decide which strategies survive.',
                kind: 'verified',
                verify: v.paidFees,
                where: { href: '/funds', label: 'See your charges' },
                lesson: 'fees-and-slippage',
            },
            {
                id: 'w2-fx',
                title: 'Trade something priced in another currency',
                why: 'Your return then has two parts, and only one of them was your idea. Knowing which half you were right about is what makes the record useful.',
                kind: 'verified',
                verify: v.tradedForeignCurrency,
                where: { href: '/terminal', label: 'Trade a US or FX instrument' },
                lesson: 'currency-and-fx',
            },
            {
                id: 'w2-cost-math',
                title: 'Work out your own annual cost drag',
                why: 'Trades per year times cost per round trip. Do it with your own numbers rather than reading mine — an edge that survives on paper and dies live usually died here.',
                kind: 'reflective',
                lesson: 'costs-in-backtests',
            },
        ],
    },
    {
        n: 3,
        title: 'A rule you can state',
        aim: 'Convert whatever you have been doing by instinct into something specific enough to be wrong.',
        trap: 'Writing a rule loose enough that it can never be violated. "Buy when the trend is strong" is not a rule; it is a mood.',
        steps: [
            {
                id: 'w3-stop',
                title: 'Decide the loss before you enter, and place the stop',
                why: 'A stop in your head is a preference. A stop in the book is a decision you have already made, taken while you were calm.',
                kind: 'verified',
                verify: v.hasStopProtection,
                where: { href: '/terminal', label: 'Place a stop' },
                lesson: 'stops',
            },
            {
                id: 'w3-size',
                title: 'Size a position from risk rather than from conviction',
                why: 'Conviction is highest exactly when you are most likely to be wrong about something. Sizing from the stop distance takes the feeling out of it.',
                kind: 'verified',
                verify: v.riskedAtMost(2),
                where: { href: '/terminal', label: 'Size a trade' },
                lesson: 'position-sizing',
            },
            {
                id: 'w3-written',
                title: 'Write your strategy down: entry, sizing, exit, universe, costs',
                why: 'All five, or it is not testable. Then write what would make you abandon it — decided now, while nothing is at stake, because it cannot be decided honestly during a drawdown.',
                kind: 'reflective',
                lesson: 'hypothesis-to-rules',
            },
            {
                id: 'w3-backtest',
                title: 'Run your idea against buy-and-hold',
                why: 'Not to see whether it made money — to see whether it beat doing nothing, which is the only comparison that means anything.',
                kind: 'reflective',
                where: { href: '/backtest', label: 'Compare strategies' },
                lesson: 'overfitting',
            },
        ],
    },
    {
        n: 4,
        title: 'Enough trades to mean something',
        aim: 'Build a sample. Until you have one, every conclusion you draw about yourself is noise.',
        trap: 'Concluding anything from ten trades. A 50% strategy produces eight losses in a row often enough that you will meet one, and most people quit inside it.',
        steps: [
            {
                id: 'w4-record',
                title: 'Build a record of at least 20 closed round trips',
                why: 'Thirty is where ratios start to mean anything; twenty is where the shape of your own behaviour becomes visible. This app withholds statistics below that threshold for the same reason.',
                kind: 'verified',
                verify: v.builtATrackRecord(20),
                where: { href: '/portfolio', label: 'See your record' },
                lesson: 'risk-of-ruin',
            },
            {
                id: 'w4-loss',
                title: 'Take a planned loss and let the stop do its job',
                why: 'A stop you move is not a stop. The first time you leave one alone is the moment the process becomes real.',
                kind: 'verified',
                verify: (c) => {
                    const n = v.countLosingTradesClosed(c);
                    return n > 0
                        ? { done: true, progress: 1, hint: `${n} losing trade${n === 1 ? '' : 's'} closed. That is the process working, not failing.` }
                        : { done: false, progress: 0, hint: 'No closed losing trade yet. This step is not asking you to lose money — only to let a planned loss complete rather than widening the stop.' };
                },
                where: { href: '/orders', label: 'Review your fills' },
                lesson: 'stops',
            },
            {
                id: 'w4-short',
                title: 'Take one short position',
                why: 'Not because shorting is a good idea, but because half of what happens in markets is invisible if you have only ever been long.',
                kind: 'verified',
                verify: v.openedAShort,
                where: { href: '/terminal', label: 'Open a short' },
                lesson: 'shorting-and-margin',
            },
        ],
    },
    {
        n: 5,
        title: 'The honest review',
        aim: 'Find out what your record actually says — including the parts you would rather it did not.',
        trap: 'Reading the equity curve and stopping there. The curve is the outcome; the average win against the average loss is the behaviour, and behaviour is what you can change.',
        steps: [
            {
                id: 'w5-blocked',
                title: 'Let a rule stop you from doing something',
                why: 'A rule that has never refused you has never been tested. This is the one step where being blocked is the pass condition.',
                kind: 'verified',
                verify: v.wasBlockedByARule,
                where: { href: '/insights', label: 'Apply a coach rule' },
                lesson: 'rules-that-bind',
            },
            {
                id: 'w5-disposition',
                title: 'Compare your average win against your average loss',
                why: 'If the average win is smaller, you are cutting winners and holding losers — the disposition effect, measured in your own numbers rather than described in a textbook.',
                kind: 'reflective',
                where: { href: '/portfolio', label: 'Read your record' },
                lesson: 'behavioural-biases',
            },
            {
                id: 'w5-decide',
                title: 'Decide, in writing, whether to continue',
                why: 'The three honest answers are keep going, change one thing, or stop. Most people never write the third one down, which is why they never choose it.',
                kind: 'reflective',
                lesson: 'paper-to-live',
            },
        ],
    },
];

export const ALL_STEPS = PROGRAMME.flatMap((w) => w.steps);

export const VERIFIED_COUNT = ALL_STEPS.filter((s) => s.kind === 'verified').length;
export const REFLECTIVE_COUNT = ALL_STEPS.filter((s) => s.kind === 'reflective').length;

/** A week is complete when every verified step passes and every reflective one is ticked. */
export function weekProgress(
    week: ProgrammeWeek,
    ctx: VerifyContext,
    /** Step id -> when it was marked. The store records a timestamp, not a flag. */
    selfMarked: Record<string, number | boolean>
): { done: number; total: number; complete: boolean } {
    let done = 0;
    for (const step of week.steps) {
        const ok = step.kind === 'verified' ? Boolean(step.verify?.(ctx).done) : Boolean(selfMarked[step.id]);
        if (ok) done++;
    }
    return { done, total: week.steps.length, complete: done === week.steps.length };
}
