import type { Lesson } from '../types';

// Track: risk, psychology and regulation (continuation).
//
// The core track already covers stops, sizing, shorting, journalling, binding rules
// and going live safely. These two complete it: the biases that defeat those rules,
// and the frauds that target the people trying to follow them.

export const RISK_ADVANCED: Lesson[] = [
    {
        slug: 'behavioural-biases',
        title: 'The biases that beat your rules',
        track: 'risk',
        level: 'intermediate',
        kind: 'study',
        minutes: 9,
        outcome: 'Name the specific biases behind your own worst trades, and the mechanical countermeasure for each.',
        where: { href: '/portfolio', label: 'Review your record' },
        visual: {
            kind: 'split-bar',
            caption: "Loss aversion, measured. Losses hurt about twice as much as the equivalent gain feels good \u2014 which is why winners get cut and losers held.",
            steps: [
                { label: "a \u20b910,000 gain", note: "feels like this", tone: 'up', value: 33 },
                { label: "a \u20b910,000 loss", note: "feels like this", tone: 'down', value: 67 },
            ],
        },
        prereq: ['journal-and-discipline'],
        concept: [
            'Knowing a bias does not remove it. The value of naming them is that each has a **mechanical** countermeasure, and mechanisms work where willpower does not.',
            '**Loss aversion.** Losses hurt roughly twice as much as equivalent gains feel good. This produces the single most common damaging pattern in trading — cutting winners early to lock in the good feeling, and holding losers to avoid realising the bad one. It is precisely backwards, and it is why "let winners run, cut losers" is repeated endlessly and followed rarely. **Countermeasure:** define both exits before entry, and place the stop as an actual order rather than a mental one.',
            '**The disposition effect** is that pattern measured: investors demonstrably sell winners at a higher rate than losers. **Countermeasure:** measure your own average win against your average loss. If the average win is smaller, you have it.',
            '**Confirmation bias.** You seek information supporting your position and discount what contradicts it, and this intensifies as the position grows. **Countermeasure:** write the disconfirming condition down before entering — "I am wrong if X" — so the exit is defined by evidence rather than mood.',
            '**Recency and availability.** Recent and vivid events dominate your estimate of what is likely. After a crash everything feels risky; after a run everything feels safe. **Countermeasure:** a written plan made in a neutral period, and position sizes that do not change with how you feel about the market.',
            '**Overconfidence and attribution.** Winning trades are remembered as skill and losing ones as bad luck, so experience can increase confidence without increasing accuracy. **Countermeasure:** a journal recording your reasoning *before* the outcome, which is the only record that cannot be rewritten afterwards.',
            '**Sunk cost.** Money already lost feels like a reason to continue. It is not — the only question is whether this position is worth holding starting now, given what you know now. **Countermeasure:** ask whether you would open this position today at this price. If not, you are holding it for its history.',
            'The pattern across all of it: **the countermeasure is always a rule made in advance and executed mechanically.** That is what this app\'s coach rules and kill switch are, and it is why the exercises here are verified against engine state rather than a checkbox — a rule you can mark done without doing is not a rule.',
        ],
        inApp: '[Portfolio](/portfolio) shows your average win against your average loss, which is the disposition effect made measurable. [Settings](/settings) holds the coach rules and the kill switch — pre-commitment devices, not advice.',
        quiz: [
            {
                question: 'What is the disposition effect?',
                options: ['Holding too long generally', 'Selling winners at a higher rate than losers — exactly backwards from "cut losses, let winners run"', 'Trading too often', 'Averaging down'],
                answer: 1,
                why: 'It is loss aversion made measurable in real trading records. If your average win is smaller than your average loss, you are doing it.',
            },
            {
                question: 'What is the reliable countermeasure to sunk-cost reasoning?',
                options: ['Wait for breakeven', 'Ask whether you would open this position today at this price — if not, you are holding it for its history', 'Average down', 'Set a wider stop'],
                answer: 1,
                why: 'Money already lost is not a reason to continue. Reframing to a fresh decision removes the history from the calculation.',
            },
        ],
    },

    {
        slug: 'scams-and-frauds',
        title: 'How investment fraud actually works',
        track: 'risk',
        level: 'foundation',
        kind: 'study',
        minutes: 9,
        outcome: 'Recognise the four structures behind most investment fraud, and verify a registration in a minute.',
        where: { href: '/settings', label: 'How this app handles credentials' },
        visual: {
            kind: 'ladder',
            caption: "Almost all investment fraud uses a handful of structures. Recognising the structure beats evaluating the claim.",
            steps: [
                { label: "guaranteed returns", note: "the defining Ponzi feature", tone: 'down', value: 100 },
                { label: "urgency", note: "exists to stop you checking", tone: 'down', value: 90 },
                { label: "unregistered adviser", note: "the SEBI register is public", tone: 'warn', value: 75 },
                { label: "social proof only", note: "screenshots are free to fabricate", tone: 'warn', value: 60 },
                { label: "asks for seed / OTP", note: "conclusive", tone: 'down', value: 100 },
            ],
        },
        concept: [
            'Investment fraud is not creative. Almost all of it uses a handful of structures that have worked for a century, and recognising the structure matters far more than evaluating the claim.',
            '**Guaranteed returns.** No legitimate market investment guarantees a return. A promised fixed monthly percentage, particularly one well above bank deposit rates, is the defining feature of a **Ponzi scheme** — early participants paid from later participants\' money, which continues until inflows stop and then ends abruptly and completely.',
            '**Pump and dump.** A group accumulates a thin, low-priced stock or token, promotes it heavily through tips, groups and paid influencers, and sells into the buying they created. The stock returns to where it started, or below. The tell is a stock nobody was discussing suddenly appearing everywhere at once — and in India, SEBI has taken enforcement action against exactly this using social media channels.',
            '**Unregistered advisers.** Anyone giving investment advice for a fee in India must be registered with SEBI, and the register is public and searchable. A "SEBI-registered" claim in a bio is not evidence; the register is. Checking takes a minute, and almost nobody does it.',
            '**Recovery scams** target people who already lost money, offering to recover it for a fee. Victim lists circulate. Being defrauded once makes you a target for the second attempt, and this is worth knowing in advance.',
            'The signals that generalise across all of them. **Urgency** — a deadline exists to prevent you checking. **Complexity presented as sophistication** — if it cannot be explained plainly, that is usually the point. **Social proof over verifiable evidence** — screenshots and testimonials are trivially fabricated; audited records and registration numbers are not. And **any request for your seed phrase, password, OTP or remote access to your device** is conclusive.',
            'The one-minute defence: **verify registration on the regulator\'s own site, and take a day.** Every legitimate opportunity survives a day of due diligence. Nothing that does not survive it was one.',
        ],
        inApp: 'This app never asks for a seed phrase and holds no wallet. Broker credentials on [Settings](/settings) are POSTed to the server and stored in Supabase Vault — **they are never returned to the browser**, and vault secret names are derived server-side rather than taken from any request.',
        quiz: [
            {
                question: 'An investment promises a guaranteed 3% monthly return. What is it?',
                options: ['A high-yield bond', 'Almost certainly a Ponzi structure — no market investment guarantees a return', 'A hedge fund', 'A structured product'],
                answer: 1,
                why: 'Guaranteed above-market returns are the defining feature. Early participants are paid from later participants\' money until inflows stop, then it ends abruptly.',
            },
            {
                question: 'Someone claims to be a SEBI-registered adviser. How do you verify it?',
                options: ['Ask for their certificate', 'Check the public SEBI register yourself — a claim in a bio is not evidence', 'Check reviews', 'Look at their track record'],
                answer: 1,
                why: 'The register is public, searchable and takes a minute. A claim, a certificate image and a testimonial are all trivially fabricated; a register entry is not.',
            },
            {
                question: 'What is the single most reliable general defence?',
                options: ['Diversify', 'Take a day — every legitimate opportunity survives a day of due diligence, and manufactured urgency exists to prevent it', 'Start small', 'Use a different broker'],
                answer: 1,
                why: 'Urgency is engineered to defeat exactly the pause that would save you. Nothing that cannot survive a day of checking was an opportunity.',
            },
        ],
        resources: [
            { kind: 'regulator', title: 'SEBI investor website', url: 'https://investor.sebi.gov.in/', why: 'Verify registrations, check the caution list, and file a complaint.' },
        ],
    },
];
