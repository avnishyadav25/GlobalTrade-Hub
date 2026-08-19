import * as v from '../verify';
import type { Lesson } from '../types';

// Track: automation.
//
// Running rules with nobody watching. Written after the automation layer was built, so
// every claim here describes something that exists: the lease, the guardrails, the
// provenance recorded on each order.
//
// The bias throughout is toward what goes WRONG. Automation is not hard because writing
// a rule is hard; it is hard because an unattended loop repeats your mistake at machine
// speed and does not get bored. Three of these six lessons are about a refusal.

export const AUTOMATION_LESSONS: Lesson[] = [
    {
        slug: 'signal-versus-order',
        title: 'A signal is not an order',
        track: 'automation',
        level: 'intermediate',
        kind: 'study',
        minutes: 7,
        outcome: 'Explain the four things that must all succeed between a rule firing and a position existing.',
        prereq: ['hypothesis-to-rules'],
        concept: [
            'A **strategy** is a definition. An **instance** is that definition pointed at one instrument, on one timeframe, with one set of parameters. The same strategy can run twice on different instruments and each keeps its own state.',
            'When an instance fires it produces a **signal**: "this rule wants to buy this much of this, and here is why". A signal is an opinion. Nothing has been risked.',
            'The signal then has to survive sizing, your guardrails, the coach rules and the engine itself. Any of those can refuse it — and a refusal is recorded, not swallowed.',
            'Only then is there an order. Confusing the two is why people believe a system "traded" when in fact it wanted to and was stopped.',
        ],
        inApp: 'An instance in **review** mode posts its signal to /signals and waits for you. In **auto** mode it goes straight on to sizing and the guardrails. The mode is per instance, not per strategy, so you can watch one instrument while another trades.',
        where: { href: '/signals', label: 'See what your strategies want to do' },
        visual: {
            kind: 'flow',
            caption: 'Four gates between a rule firing and a position existing. Any of them can say no.',
            steps: [
                { label: 'rule fires', note: 'a signal, not a trade', tone: 'accent' },
                { label: 'sized', note: 'from risk, or the value cap', tone: 'accent' },
                { label: 'guardrails', note: 'can refuse here', tone: 'warn' },
                { label: 'coach rules + engine', note: 'can refuse here too', tone: 'warn' },
                { label: 'order exists', tone: 'up' },
            ],
        },
        tradeoffs: {
            pros: [
                'Review mode lets you watch a strategy for weeks before it ever risks anything.',
                'Every refusal is written to the Orders screen with its reason, so silence is diagnosable.',
            ],
            cons: [
                'A signal you approve by hand is no longer the strategy being tested — it is you, using the strategy as an opinion.',
                'Reviewing every signal does not scale, and the delay changes the fill you get.',
            ],
        },
        quiz: [
            {
                question: 'An instance in review mode fires and you never look at the queue. What happened?',
                options: [
                    'The order was placed with default sizing',
                    'Nothing was placed; the signal expires',
                    'It was placed only if the guardrails allowed it',
                ],
                answer: 1,
                why: 'Review mode places nothing without you. Signals also go stale — the price they referenced has moved — so an unread queue is not a backlog of trades waiting to happen.',
            },
            {
                question: 'What is the difference between a strategy and an instance?',
                options: [
                    'None, they are the same thing named differently',
                    'A strategy is the rule; an instance is that rule running on one instrument with one set of parameters',
                    'An instance is a strategy that has been backtested',
                ],
                answer: 1,
                why: 'The distinction matters because two instances of one strategy, on different instruments, keep separate state and can be in different modes.',
            },
        ],
    },
    {
        slug: 'run-a-strategy',
        title: 'Run a strategy and let it place an order',
        track: 'automation',
        level: 'intermediate',
        kind: 'practice',
        minutes: 12,
        outcome: 'Have an order in your book that the ledger attributes to a strategy rather than to you.',
        prereq: ['signal-versus-order'],
        concept: [
            'Reading about automation teaches you very little. The first time a rule you wrote places an order without asking, it feels different — and that feeling is the point of doing this on paper.',
            'Every order now records **what placed it**: you, a strategy (and which one), the AI agent, or expiry settlement. That is why this exercise can be checked against your ledger rather than taken on trust.',
        ],
        inApp: 'Pick any strategy from /strategies, enable it on an instrument, and either approve its signal on /signals or switch that instance to automatic. The Orders screen shows a "Placed by" column.',
        where: { href: '/strategies', label: 'Pick a strategy to run' },
        visual: {
            kind: 'timeline',
            caption: 'What the ledger records, and why "placed by" is the column that matters here.',
            steps: [
                { label: 'enable instance', note: 'review mode by default', tone: 'accent' },
                { label: 'signal appears', note: '/signals', tone: 'accent' },
                { label: 'approve, or set auto', tone: 'warn' },
                { label: 'order stamped', note: 'placed by: strategy', tone: 'up' },
            ],
        },
        exercise: {
            title: 'Get one order into the book from a strategy',
            body: 'Enable any strategy on any instrument. Then either approve the signal it posts to **/signals**, or use "to auto" on the strategy page and let it place by itself. Check **/orders** — the "Placed by" column should name the strategy, not you.',
            verify: v.placedByAnyStrategy,
        },
        quiz: [
            {
                question: 'Why can this exercise not be completed by clicking "done"?',
                options: [
                    'It can, there is a button',
                    'It reads your actual order book and looks for an order attributed to a strategy',
                    'It checks whether you visited the strategies page',
                ],
                answer: 1,
                why: 'Every exercise in this course is a predicate over persisted engine state. Provenance on the order is what makes this one checkable.',
            },
        ],
    },
    {
        slug: 'let-a-guardrail-refuse-you',
        title: 'Let a guardrail refuse a trade',
        track: 'automation',
        level: 'intermediate',
        kind: 'practice',
        minutes: 10,
        outcome: 'See a limit you set actually block an order, and read the reason it gives.',
        prereq: ['run-a-strategy'],
        concept: [
            'A limit that has never refused you has never been tested. You do not know whether it works, whether it is set where you meant, or what it looks like when it fires.',
            'Guardrails bind **every automated path** — the AI agent and your own deterministic strategies alike. That was not always true, and the gap was invisible from the screen that advertised them.',
            'Every cap here limits how much you may **take on**. None of them can stop you closing a position. A risk control that traps you in a losing trade is not a risk control.',
        ],
        inApp: 'Guardrails live on /agents: order value, daily loss, open positions, orders per day, per-symbol concentration, a square-off buffer and a market-hours switch. A refusal is written to /orders with the reason, not just flashed as a toast.',
        where: { href: '/agents', label: 'Set your guardrails' },
        visual: {
            kind: 'split-bar',
            caption: 'Caps apply when opening. Closing is always allowed, because being unable to exit is not risk control.',
            a: 'blocks an OPEN',
            b: 'never blocks a CLOSE',
            steps: [
                { label: 'max open positions', tone: 'warn', value: 1 },
                { label: 'daily loss limit', tone: 'warn', value: 1 },
                { label: 'orders per day', tone: 'warn', value: 1 },
                { label: 'concentration cap', tone: 'warn', value: 1 },
                { label: 'market hours', note: 'binds BOTH ways — a shut market is physics', tone: 'down', value: 1 },
            ],
        },
        tradeoffs: {
            pros: [
                'A daily loss limit stops a broken rule from compounding while you sleep.',
                'Refusals are recorded, so a strategy that has quietly done nothing for a week is diagnosable.',
            ],
            cons: [
                'A cap set too tight means the strategy you are trying to evaluate never gets a fair sample.',
                'Guardrails cannot save a strategy that has no edge — they only bound how fast you find out.',
            ],
        },
        exercise: {
            title: 'Get an order refused on purpose',
            body: 'On **/agents**, set a guardrail deliberately tight — MAX ORDERS / DAY of 1 is the quickest. Then let a strategy try to trade again, and read the refusal on **/orders**. Being blocked is the pass condition here.',
            verify: v.refusedByAGuardrail,
        },
        quiz: [
            {
                question: 'You are at your maximum open positions and a strategy signals an exit. What happens?',
                options: [
                    'The exit is refused, because you are at the limit',
                    'The exit is allowed — exposure caps only apply to opening',
                    'The exit is queued until a position closes',
                ],
                answer: 1,
                why: 'If exposure caps blocked exits, hitting your position limit or your daily loss limit would leave you unable to close the very positions that got you there.',
            },
            {
                question: 'Why does the market-hours rule apply to closing as well as opening?',
                options: [
                    'It does not; closing is always allowed',
                    'Because a shut market cannot fill an order in either direction',
                    'Because exits are riskier out of hours',
                ],
                answer: 1,
                why: 'That rule is physics rather than risk appetite. The square-off buffer, by contrast, is explicitly about new positions and does not block a close.',
            },
        ],
    },
    {
        slug: 'one-writer-only',
        title: 'Why only one thing may write the ledger',
        track: 'automation',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Explain how two copies of a system can both be correct and still lose a trade between them.',
        prereq: ['let-a-guardrail-refuse-you'],
        concept: [
            'Automation can run in your browser or on a server. Both read the same book and both would write it back.',
            'Suppose both start from the same book, and both place an order. Each writes a book that is internally perfectly consistent — cash, positions and fees all balance. One of the two orders simply does not exist any more.',
            'That is the nastiest shape a bug can take: nothing looks broken. No error, no imbalance, no warning. Just a trade you remember making that is not in the record.',
            'Merging two divergent order books is not solvable in general, so this app does not try. It makes the situation impossible instead — a **lease**, so only one runner acts, plus a compare-and-set write, so a runner that was overtaken abandons its work rather than overwriting.',
        ],
        inApp: 'The browser checks in every 45 seconds while it is running strategies. The server runner refuses to act if a check-in landed in the last 3 minutes. The browser always wins: if a tab is open, it is already doing the work.',
        where: { href: '/signals', label: 'Where the browser loop reports' },
        visual: {
            kind: 'two-series',
            caption: 'Two runners from one book. Both books balance afterwards; one order has vanished.',
            a: 'browser',
            b: 'server',
            seriesA: [100, 101, 101, 101],
            seriesB: [100, 100, 101, 101],
        },
        tradeoffs: {
            pros: [
                'A lease is simple enough to reason about, and it fails in the safe direction: when in doubt, the server does nothing.',
                'The compare-and-set write means even a mid-run handover cannot lose an order.',
            ],
            cons: [
                'Only one runner works at a time, so opening a tab pauses the server rather than adding capacity.',
                'A stale lease means up to three minutes where neither side trades.',
            ],
        },
        quiz: [
            {
                question: 'Two runners start from the same book and each places one order. What is the symptom?',
                options: [
                    'The ledger identity fails and the app warns you',
                    'Nothing looks wrong; one order is simply missing from the record',
                    'The second write is rejected automatically',
                ],
                answer: 1,
                why: 'Each book is internally consistent, so every balance check passes. That is exactly why it has to be made impossible rather than detected afterwards.',
            },
            {
                question: 'Why is the lease not sufficient on its own?',
                options: [
                    'It is sufficient',
                    'A browser tab can open in the middle of a server run, so the write also needs a precondition',
                    'Because leases expire',
                ],
                answer: 1,
                why: 'The lease makes collision unlikely; the compare-and-set write on the book is what makes a lost order impossible.',
            },
        ],
    },
    {
        slug: 'unattended-and-honest',
        title: 'What "running" actually means',
        track: 'automation',
        level: 'advanced',
        kind: 'study',
        minutes: 7,
        outcome: 'Say precisely when your automation is and is not working, rather than assuming it is.',
        prereq: ['one-writer-only'],
        concept: [
            'The browser loop runs only while a tab is open. Close the laptop and nothing evaluates. That is not a limitation to be embarrassed about — it is a fact to design around.',
            'A self-hosted scheduler keeps things running with no browser, but it is only as reliable as the machine it runs on. **A sleeping laptop is a stopped scheduler.**',
            'So the app never says "running on the server" because a setting is switched on. It says so because a run actually checked in recently. A status derived from intent rather than evidence is how software starts lying about itself.',
            'If a strategy has been silent for a week, the question is not "is the rule wrong" but "did anything actually evaluate it". Those are very different investigations.',
        ],
        inApp: 'The lease row records both the last browser check-in and the last server run. Setup, launchd and systemd are covered in docs/AUTOMATION.md.',
        where: { href: '/signals', label: 'Check what has actually fired' },
        visual: {
            kind: 'gauge',
            caption: 'Derived from a recent check-in, never from a switch being on. No evidence means not running.',
            value: 0.34,
            unit: 'evidence of a live runner',
        },
        quiz: [
            {
                question: 'Your scheduler script was started this morning and the laptop then slept for six hours. What ran?',
                options: [
                    'Nothing while it slept',
                    'It caught up on all missed runs when the machine woke',
                    'The server kept running independently',
                ],
                answer: 0,
                why: 'A self-hosted scheduler is a process on your machine. There is no catch-up, and no history is backfilled — which is exactly why the status is derived from a real check-in.',
            },
        ],
    },
    {
        slug: 'when-to-switch-to-auto',
        title: 'When to let it trade without you',
        track: 'automation',
        level: 'expert',
        kind: 'study',
        minutes: 8,
        outcome: 'Decide, with reasons you have written down, whether an instance is ready for automatic mode.',
        prereq: ['unattended-and-honest'],
        concept: [
            'Automatic mode is not a reward for a strategy that has been profitable. Profit over a small sample is mostly noise, and switching on the back of it is the most common way people automate a coin flip.',
            'The question is narrower: **has this instance behaved as I expected, for reasons I understand?** A strategy that made money by firing at moments you cannot explain is less ready than one that lost a little doing exactly what you designed.',
            'Before switching, know what would make you switch it off again. Decided now, while nothing is at stake — because it cannot be decided honestly during a drawdown.',
            'And set the caps first. The guardrails are what bound your loss while you find out you were wrong; adding them after the fact is adding a seatbelt after the crash.',
        ],
        inApp: 'Use "to auto" on the strategy page, per instance. Review mode is the default deliberately: everything here ships in review, and automatic is opted into once you have watched what it does.',
        where: { href: '/strategies', label: 'Review your running instances' },
        visual: {
            kind: 'cycle',
            caption: 'The loop worth running. Note that it starts again rather than ending in "profit".',
            steps: [
                { label: 'write the rule', tone: 'accent' },
                { label: 'run it in review', tone: 'accent' },
                { label: 'watch what it does', note: 'and what it refuses', tone: 'warn' },
                { label: 'set the caps', tone: 'warn' },
                { label: 'switch to auto', tone: 'up' },
                { label: 'review the record', note: 'then change one thing', tone: 'accent' },
            ],
        },
        tradeoffs: {
            pros: [
                'Automatic mode removes hesitation, which is where most discretionary damage happens.',
                'It produces a clean sample: the rule as written, not the rule as you felt about it that morning.',
            ],
            cons: [
                'It also removes the pause where you would have noticed the rule was wrong.',
                'An unattended loop repeats your mistake at machine speed and never gets bored.',
            ],
        },
        quiz: [
            {
                question: 'An instance has made money for three weeks in review mode. Is it ready for automatic?',
                options: [
                    'Yes, three weeks of profit is evidence',
                    'Not on that basis alone — the question is whether it behaved as designed, for reasons you understand',
                    'Only if it beat buy-and-hold',
                ],
                answer: 1,
                why: 'Profit over a small sample is mostly noise. A strategy that lost a little doing exactly what you designed is better understood than one that made money at moments you cannot explain.',
            },
            {
                question: 'When should you decide what would make you switch it off?',
                options: [
                    'When it starts losing',
                    'Before you switch it on, in writing',
                    'After a full quarter of data',
                ],
                answer: 1,
                why: 'That decision cannot be made honestly during a drawdown, which is precisely when you will need it.',
            },
        ],
    },
];
