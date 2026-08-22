import * as v from '../verify';
import type { Lesson } from '../types';

// Track: strategy and systems.
//
// This track describes what the app already enforces, so most lessons point at a real
// mechanism: the sample-size gate, the benchmark row, the no-lookahead accessor, the
// shared charges module. Where the app has a limitation, the lesson says so.

export const STRATEGY_LESSONS: Lesson[] = [
    {
        slug: 'hypothesis-to-rules',
        title: 'From an idea to something testable',
        track: 'strategy',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Turn a vague market belief into rules a computer could execute without asking you anything.',
        where: { href: '/strategies', label: 'Read a strategy definition' },
        visual: {
            kind: 'flow',
            caption: "A testable strategy specifies five things. Leaving any unstated means you decide it differently each time.",
            steps: [
                { label: "entry", note: "the precise condition", tone: 'accent' },
                { label: "sizing", note: "as a function of something" },
                { label: "exit", note: "both the losing and the winning one" },
                { label: "universe", note: "which instruments, which timeframe" },
                { label: "costs", note: "what a round trip actually costs", tone: 'warn' },
            ],
        },
        concept: [
            'Most trading ideas are not wrong. They are **unfalsifiable** — stated so loosely that no evidence could contradict them, which also means no evidence can support them.',
            '"Buy when the trend is strong" is not a rule. Whose trend, measured how, over what lookback, strong by what threshold, buy how much, sell when? Every one of those is a decision, and leaving them unstated means you make them differently each time and can never learn whether the idea works.',
            'A testable strategy specifies five things without exception. **Entry** — the precise condition. **Sizing** — how much, as a function of something. **Exit** — both the losing exit and the winning one. **Universe** — which instruments and which timeframe. **Costs** — what a round trip actually costs on this instrument.',
            'The discipline that makes this real is writing it as **code before you look at results**. Code cannot be vague. It forces you to decide what "strong" means, and once decided it applies identically to every bar — including the bars where you would have talked yourself out of it.',
            'Then the most important part, and the one usually skipped: **write down what would prove the idea wrong, before you test.** "If this produces fewer than 20 trades, I learn nothing. If it fails to beat buy-and-hold over the full period, I discard it. If its drawdown exceeds 25%, I would not have held it, so a good return is irrelevant." Deciding the disqualifying criteria in advance is what separates a test from a search for confirmation.',
        ],
        inApp: 'Every strategy in the [library](/strategies) is a `Strategy` object with an explicit `params` list, a `warmup`, an `onBar` and an `explain` block that states its idea, its entry, its exit and — importantly — **when it fails**. That last field is required, not optional.',
        quiz: [
            {
                question: 'What must be decided before you look at a backtest result?',
                options: ['The position size', 'What result would make you discard the idea', 'The instrument', 'The colour of the chart'],
                answer: 1,
                why: 'Disqualifying criteria set in advance are what make it a test. Chosen afterwards, any result can be read as encouraging.',
            },
            {
                question: 'Why write a strategy as code rather than as a description?',
                options: ['It runs faster', 'Code cannot be vague — it forces every judgement to be decided once and applied identically to every bar', 'It looks professional', 'To share it'],
                answer: 1,
                why: 'A description lets you re-interpret the rule on each bar, including the bars where you would have talked yourself out of the trade.',
            },
        ],
    },

    {
        slug: 'overfitting',
        title: 'Overfitting: finding a pattern that was never there',
        track: 'strategy',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Recognise the three signatures of a curve-fitted result in your own work.',
        where: { href: '/backtest', label: 'Run a comparison' },
        visual: {
            kind: 'two-series',
            caption: "A real edge is a plateau. A spike where only one value works is a coincidence that happens to have a name.",
            a: "overfitted",
            b: "robust",
            seriesA: [0, 1, 2, 48, 3, 1, 0],
            seriesB: [8, 11, 13, 14, 13, 11, 8],
        },
        prereq: ['hypothesis-to-rules'],
        concept: [
            '**Overfitting** is building a rule that describes the noise in your sample rather than any real structure. It is the central failure of systematic trading, and it does not feel like a mistake while you are doing it — it feels like research.',
            'The arithmetic is unforgiving. **Test 100 parameter combinations at the 5% significance level and about 5 will look significant by chance alone.** Test 1,000 and you get 50 impressive-looking results from pure randomness. Since the search is usually undocumented — you try things, keep what works — the reported result is the maximum of an unreported distribution, which is not a meaningful statistic at all.',
            'Three signatures show up reliably. **Fragility**: results collapse when a parameter moves slightly. A real edge is a plateau — 18, 20 and 22 all work. A spike where only 20 works is a coincidence with a name. **Complexity**: each added rule and filter fits more noise, and a strategy with nine conditions has usually memorised its sample. **Too few trades**: a spectacular return from twelve trades is twelve coin flips.',
            'The defences are simple and unpopular because they all reduce your reported number. **Hold out data** you do not look at until the end. **Prefer fewer parameters.** **Demand a plateau** rather than a peak. **Count your trades** and disbelieve statistics below about 30. And **document how many variants you tried** — that count is what your result must be judged against.',
            'The most honest defence is the cheapest: **be suspicious of your own good results.** An idea that works immediately, at the first parameters you tried, on the first instrument you tested, is more likely to be luck than insight. Real edges are usually small, fragile in live trading, and unimpressive on a chart.',
        ],
        inApp: '[Compare strategies](/backtest) deliberately runs every strategy at its **default** parameters. Tuning each one first would be choosing the winner with hindsight, and the ranking would stop meaning anything. Ratio statistics are suppressed below `MIN_TRADES_FOR_STATS = 30` with the reason shown.',
        quiz: [
            {
                question: 'A parameter of 20 produces excellent results; 18 and 22 produce nothing. What does that indicate?',
                options: ['You found the optimum', 'Overfitting — a real edge is a plateau, not a spike', 'The data is bad', 'Try 19'],
                answer: 1,
                why: 'Real structure is robust to small parameter changes. A single working value surrounded by failures is a coincidence that happened to have a name.',
            },
            {
                question: 'Why should you record how many variants you tested?',
                options: ['For documentation', 'Because the reported result is the maximum of that search, and must be judged against how many chances it had', 'To repeat it later', 'Regulation'],
                answer: 1,
                why: 'Five significant results from 100 tests is exactly what chance predicts. Without the denominator, the numerator means nothing.',
            },
        ],
    },

    {
        slug: 'walk-forward',
        title: 'Walk-forward: testing the way you would actually trade',
        track: 'strategy',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Explain why in-sample results are worthless and what degradation is acceptable.',
        where: { href: '/backtest/walk-forward', label: 'Run a walk-forward' },
        visual: {
            kind: 'timeline',
            caption: "Optimise on data you had; measure on data you had not seen. The gap between them is the finding.",
            steps: [
                { label: "train", note: "choose parameters here", tone: 'accent' },
                { label: "test", note: "measure them here", tone: 'up' },
                { label: "roll forward", note: "and repeat" },
                { label: "degradation", note: "how much was fitting", tone: 'down' },
            ],
        },
        prereq: ['overfitting'],
        concept: [
            'A single backtest over all your data answers a question nobody has: *if I had known the best parameters in advance, how would this have done?* You did not know them in advance. That is the whole difficulty.',
            '**Walk-forward analysis** removes the hindsight. Optimise on a window of data, then trade the chosen parameters on the following window that the optimisation never saw. Roll both windows forward and repeat. The out-of-sample results, stitched together, are a much closer analogue of live trading, because at every point the parameters were chosen using only past data.',
            'The comparison it produces is the useful output. **In-sample versus out-of-sample degradation** tells you how much of your result was fitting. Some degradation is always expected — optimisation always captures some noise. Severe degradation, or out-of-sample results near zero, means the in-sample result was the noise.',
            'A second reading is available and often more valuable: **parameter stability across windows.** If the optimiser picks 20 in one window, 45 in the next and 12 in the third, there is no stable relationship to find. The parameter is not measuring anything persistent, and no amount of re-optimisation will fix that.',
            'Walk-forward is not a cure. It has its own hazards — repeated walk-forward runs with different window sizes and re-optimisation rules is itself a search you can overfit, at a higher level of abstraction. But it is a much harder test to pass than a single backtest, and passing a harder test is the only evidence worth having.',
        ],
        inApp: '[Walk-forward](/backtest/walk-forward) does exactly this. Pick a grid, and it reports in-sample against out-of-sample per fold, plus whether the winning parameters changed between folds. The run happens in a worker because a default grid over four folds is more than a thousand backtests. Compare a result there with [Compare strategies](/backtest), which runs a single window — a strategy that looks good there and degrades sharply here was fitted, not found.',
        quiz: [
            {
                question: 'Why is a single full-period backtest misleading?',
                options: ['The data is too short', 'It answers what would have happened if you had known the best parameters in advance — which you did not', 'It ignores costs', 'It is too slow'],
                answer: 1,
                why: 'Choosing parameters over the same period you measure embeds hindsight. Walk-forward chooses using only prior data, which is the situation you are actually in.',
            },
            {
                question: 'The optimiser picks wildly different parameters in each window. What does that mean?',
                options: ['The market is changing usefully', 'There is no stable relationship to find, and re-optimising will not create one', 'Use the average', 'Use a longer window'],
                answer: 1,
                why: 'Parameter instability means the parameter is fitting noise in each window separately. That is a finding about the idea, not a tuning problem.',
            },
        ],
    },

    {
        slug: 'costs-in-backtests',
        title: 'Costs: where paper edges go to die',
        track: 'strategy',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Estimate a realistic round-trip cost and apply it before believing any result.',
        where: { href: '/funds', label: 'See the itemised charges' },
        visual: {
            kind: 'counter',
            caption: "200 round trips a year at 8.24 bps, before the strategy has been right about anything.",
            value: 16.5,
            unit: "%",
            a: "annual cost drag",
        },
        prereq: ['walk-forward'],
        concept: [
            'A backtest that ignores costs is not optimistic; it describes a different universe. And the error is proportional to trading frequency, so it hits precisely the strategies that look most exciting.',
            'The real cost of a round trip is four things, and only the first is usually counted. **Brokerage** — capped per order in India, which means it matters more on small orders than large. **Statutory charges** — STT, exchange transaction fee, SEBI turnover fee, stamp duty, and GST on the service components. **Spread** — you buy at the ask and sell at the bid, and this is a real cost even when no commission is charged. **Slippage** — the difference between the price you saw and the price you got, which grows with size and with how urgently you trade.',
            'This app models the first two exactly. A ₹1,00,000 Indian equity round trip costs about **8.24 basis points intraday** and about **23.57 basis points delivery** — the difference is almost entirely STT asymmetry, charged sell-side only at 0.025% intraday versus both sides at 0.1% for delivery.',
            'Now apply that. A strategy trading 200 times a year at 8 bps a round trip pays about **16% annually in costs** before it has been right about anything. An edge of 0.5% per trade sounds substantial and is roughly wiped out at these frequencies. **This is the single most common reason a promising backtest fails live**, and it is entirely predictable in advance.',
            'The two dishonest moves to avoid in your own work: assuming you always fill at the mid price, and assuming you can execute size at the quoted price. Both are free money in a backtest and unavailable in reality.',
            'The structural fix, which this codebase applies: **the simulator and the backtester share one cost module.** If they used different numbers, a paper track record would not predict a backtest and neither would predict live trading.',
        ],
        inApp: '`lib/charges.ts` is used by **both** `paperEngine.estimateCharges` and the backtester. [Funds](/funds) itemises brokerage, STT, exchange fee, SEBI turnover fee, stamp duty and GST separately, so you can see where a cost came from rather than trusting a blended constant.',
        formulas: [
            {
                label: 'Annual cost drag',
                expr: 'drag = round trips per year × cost per round trip',
                terms: [{ sym: 'cost per round trip', meaning: 'brokerage + statutory charges + spread + slippage' }],
                worked: () => '200 round trips at 8.24 bps ≈ 16.5% a year, paid before the strategy is right about anything.',
            },
        ],
        quiz: [
            {
                question: 'Why does an intraday round trip cost far less than a delivery one in India?',
                options: ['Lower brokerage', 'STT: 0.025% sell-side only intraday, versus 0.1% on both legs for delivery', 'No GST intraday', 'Exchange fees differ'],
                answer: 1,
                why: 'About 8.24 bps against 23.57 bps at ₹1,00,000, and the STT asymmetry is nearly all of the gap. It is why some strategies survive intraday and not on delivery.',
            },
            {
                question: 'Why must the simulator and backtester share one cost module?',
                options: ['Code cleanliness', 'Otherwise a paper record would not predict a backtest and neither would predict live trading', 'Performance', 'Regulation'],
                answer: 1,
                why: 'Three different cost models would give three incomparable track records. Sharing one is what makes the paper record mean anything.',
            },
        ],
    },

    {
        slug: 'systematic-sizing',
        title: 'Sizing a system: from risk, never from conviction',
        track: 'strategy',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Size from risk rather than from conviction, and survive a losing streak.',
        tradeoffs: {
            pros: [
                "Every position risks the same amount even though instruments behave nothing alike",
                "It removes conviction from the calculation, and conviction is highest when you are most likely wrong",
                "A survivable losing streak becomes arithmetic rather than hope",
            ],
            cons: [
                "It feels wrong to size down exactly when you are most confident",
                "Volatility measured on the past understates it before a shock, so you size UP into the quiet",
                "It caps the upside of your best ideas as firmly as the downside of your worst",
            ],
        },
        where: { href: '/terminal', label: 'Size a position' },
        prereq: ['hypothesis-to-rules', 'position-sizing'],
        visual: 'risk-sizing',
        concept: [
            'Traders spend most of their attention on entries and most of their money on sizing. The asymmetry is worth correcting deliberately, because **a mediocre entry with good sizing survives; an excellent entry with bad sizing does not.**',
            'The principle is to size from **risk**, not from conviction or from what you can afford. Decide the fraction of the account you accept losing if this trade fails — commonly 0.5% to 2% — then work backwards through the stop distance to a quantity. Conviction has no place in the formula, because conviction is highest exactly when you are most likely to be wrong about something.',
            'This automatically produces the right behaviour across instruments. A volatile instrument needs a wider stop, so the same rupee risk buys fewer units; a calm one gets more. **Every position risks the same amount even though the instruments behave nothing alike**, without you having to judge it each time.',
            'The reason to keep the fraction small is a losing streak, which is far more likely than intuition suggests. **A strategy with a 50% win rate will produce a run of eight consecutive losses reasonably often over a few hundred trades.** At 2% risk that is a 15% drawdown; at 10% risk it is well over half the account and the recovery arithmetic becomes hostile.',
            '**Kelly sizing** — the mathematically growth-optimal fraction — is worth knowing about and not worth using at full size. It assumes you know your edge and win rate exactly, which you do not, and it overshoots badly when those estimates are wrong. Practitioners who use it at all use a half or a quarter of it. The full Kelly fraction is optimal for a gambler with a known edge and dangerous for a trader with an estimated one.',
        ],
        inApp: 'Position sizing is applied at [Terminal](/terminal), and `sizeForSignal` in `lib/strategies/runtime.ts` does the same job for automated signals — one sizing path for both manual and automated orders.',
        formulas: [
            {
                label: 'Risk-based size',
                expr: 'quantity = (equity × risk fraction) ÷ (entry − stop)',
                terms: [{ sym: 'entry − stop', meaning: 'risk per unit, in the instrument\'s own currency' }],
                worked: () => '₹5,00,000 at 1% risk is ₹5,000. A stop ₹40 below entry gives 125 units — regardless of how confident you feel.',
            },
        ],
        quiz: [
            {
                question: 'Why should conviction not enter the sizing formula?',
                options: ['It is hard to quantify', 'Conviction is highest exactly when you are most likely to be wrong about something', 'It changes too fast', 'It should enter it'],
                answer: 1,
                why: 'Sizing from risk gives a stable, survivable result. Sizing from confidence concentrates the largest positions where your judgement is least reliable.',
            },
            {
                question: 'A 50% win-rate strategy over a few hundred trades will produce runs of eight losses. What does that mean at 10% risk per trade?',
                options: ['A minor drawdown', 'Well over half the account gone, with hostile recovery arithmetic', 'Nothing, it recovers', 'The strategy is broken'],
                answer: 1,
                why: 'Streaks are ordinary, not exceptional. Sizing must be survivable through the streak the strategy is statistically certain to produce.',
            },
        ],
    },

    {
        slug: 'correlation-and-concentration',
        title: 'Correlation: when six positions are really one',
        track: 'strategy',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Measure real diversification rather than counting positions.',
        where: { href: '/backtest/portfolio', label: 'Measure it on a real basket' },
        visual: {
            kind: 'two-series',
            caption: "Correlations rise toward 1 in a crisis. The diversification you measured in calm data is partly absent when you need it.",
            a: "asset A",
            b: "asset B",
            seriesA: [100, 104, 101, 107, 110, 106, 72, 66],
            seriesB: [100, 97, 103, 99, 104, 108, 71, 64],
        },
        prereq: ['systematic-sizing'],
        concept: [
            'Six positions look diversified. If they are six Indian IT companies, they are approximately one position with extra transaction costs. **Diversification is about correlation, not count.**',
            'Correlation runs from −1 to +1. Two assets at +0.9 move together and provide almost no diversification against each other. What you are looking for is exposures that respond to *different* things — and the honest test is not "are these different companies" but "what would make all of these fall at once?"',
            'The hidden correlations are the dangerous ones because they are not visible in the position list. Six different stocks with the same currency exposure. Long equity plus short volatility — different instruments, the same bet. A strategy portfolio where every member is a trend follower, all of which lose money in a range simultaneously. **The strategy library in this app can produce exactly this**, which is why running several correlated strategies is not the same as diversifying.',
            'The point that undermines the whole comfort of correlation analysis: **correlations rise toward 1 in crises.** The diversification you measured in calm data is partly absent in the episode you built it for, because in a broad liquidation everything correlated with risk appetite is sold together. Historical correlation understates crisis correlation, reliably.',
            'What follows practically: size on the assumption that correlations will be higher than measured, count **exposures** rather than positions, and treat cash as the one holding that genuinely does not correlate with anything.',
        ],
        inApp: '[Portfolio test](/backtest/portfolio) runs one strategy across several instruments and shows the correlation matrix between them, plus the portfolio drawdown against the weighted average of the individual ones. **The gap between those two figures is the diversification** — when it is near zero, several instruments were one position with several sets of costs. [Portfolio](/portfolio) shows the same concentration risk in your live paper book.',
        quiz: [
            {
                question: 'You hold six Indian IT stocks. How diversified are you?',
                options: ['Six positions worth', 'Approximately one position, with six sets of transaction costs', 'Fully diversified', 'It depends on size'],
                answer: 1,
                why: 'Diversification depends on correlation, not count. Six highly correlated holdings share a single set of drivers and fall together.',
            },
            {
                question: 'What happens to correlations in a crisis?',
                options: ['They fall', 'They rise toward 1 — the diversification measured in calm data is partly absent when you need it', 'They stay constant', 'They become negative'],
                answer: 1,
                why: 'In a broad liquidation everything correlated with risk appetite is sold together. Historical correlation reliably understates crisis correlation.',
            },
        ],
    },

    {
        slug: 'risk-of-ruin',
        title: 'Risk of ruin and the arithmetic of recovery',
        track: 'strategy',
        level: 'expert',
        kind: 'study',
        minutes: 9,
        outcome: 'Explain why drawdowns are asymmetric and what that implies for maximum position size.',
        where: { href: '/portfolio', label: 'Look at your drawdown' },
        prereq: ['systematic-sizing'],
        visual: 'compounding',
        concept: [
            'The single most important asymmetry in trading is that **a loss requires a larger gain to undo it.** Lose 10% and you need 11.1% to get back. Lose 50% and you need 100%. Lose 90% and you need 900%.',
            'This is not psychology, it is arithmetic: the gain is computed on the smaller remaining base. And it means large drawdowns are not merely painful — they are **mathematically expensive** in a way that compounds against you for the rest of the account\'s life.',
            '**Risk of ruin** is the probability that a sequence of losses reduces the account below the point where it can continue. It depends on your edge, your win rate, and above all on your position size. The critical insight is that **with a positive edge, risk of ruin still approaches certainty if position size is large enough.** Being right on average does not save you if a normal losing streak can end you first.',
            'This is why sizing matters more than accuracy, and why the answer is always smaller than feels necessary. Survival is a precondition for everything else: **you cannot compound an account that is gone**, however good the strategy would have been over the next hundred trades.',
            'The related trap is the **martingale** instinct — doubling down after losses to recover. It converts a series of small losses into one catastrophic one, and it works reliably right up until the run that breaks the account. Every system that has ever blown up quickly had some version of this in it.',
            'The practical rule, stated as a rule: **decide the maximum drawdown you would accept before it happens, and size so that a realistic losing streak stays inside it.** Deciding during the drawdown is deciding under the worst possible conditions.',
        ],
        inApp: '[Portfolio](/portfolio) shows your maximum drawdown from the sampled equity curve. The [kill switch](/settings) exists for exactly this — a pre-committed stop is worth more than a resolution made mid-drawdown.',
        formulas: [
            {
                label: 'Recovery required',
                expr: 'gain to recover = 1 ÷ (1 − drawdown) − 1',
                terms: [{ sym: 'drawdown', meaning: 'peak-to-trough loss as a fraction' }],
                worked: () => '−10% needs +11.1%. −25% needs +33.3%. −50% needs +100%. −75% needs +300%.',
            },
        ],
        quiz: [
            {
                question: 'You lose 50%. What gain returns you to breakeven?',
                options: ['50%', '75%', '100%', '150%'],
                answer: 2,
                why: 'The gain is computed on the smaller remaining base. This asymmetry is why drawdown control matters more than upside capture.',
            },
            {
                question: 'You have a genuine positive edge. Can you still be ruined?',
                options: ['No', 'Yes — with large enough position sizing, a normal losing streak ends the account before the edge can play out', 'Only with leverage', 'Only in crypto'],
                answer: 1,
                why: 'Risk of ruin approaches certainty as size grows, regardless of edge. Survival is a precondition for compounding, not a consequence of being right.',
            },
        ],
    },

    {
        slug: 'when-to-kill-a-strategy',
        title: 'Knowing when a strategy has stopped working',
        track: 'strategy',
        level: 'expert',
        kind: 'study',
        minutes: 9,
        outcome: 'Distinguish a normal drawdown from a broken edge, using criteria set in advance.',
        where: { href: '/strategies', label: 'Review your strategies' },
        visual: {
            kind: 'gauge',
            caption: "A live drawdown deeper than anything in testing is evidence of a changed regime, not merely bad luck.",
            value: 0.85,
            a: "within tested range",
            b: "beyond it \u2014 stop",
            unit: "% of worst tested DD",
        },
        prereq: ['risk-of-ruin'],
        concept: [
            'Every strategy has losing periods, and every dead strategy also has losing periods. Telling them apart in real time is genuinely hard, and it is where most systematic traders actually fail — not in the research, but in deciding whether to keep going.',
            'The two errors are symmetric and both expensive. **Abandoning a working strategy** during a normal drawdown means you take the losses and miss the recovery — and since trend-following returns concentrate in a few large winners, quitting during the drought is close to guaranteeing the loss. **Persisting with a broken one** means funding a strategy whose edge has been competed away.',
            'The only real defence is deciding in advance, because the decision cannot be made honestly while you are inside it. Before deploying, write down: **the worst drawdown observed in testing** (a live drawdown meaningfully deeper than anything in the backtest is evidence of a changed regime, not just bad luck), **the expected longest losing streak**, and **the return you would need to see over N trades to keep going.**',
            'Then watch for the things that indicate a genuine break rather than variance. **Behaviour outside the tested envelope** — win rate, trade frequency or average holding period departing materially from the backtest — means the strategy is trading a different market from the one it was fitted to. **A known structural change** — a rule change, a competitor arbitraging the same signal, a market microstructure shift — is a reason to stop regardless of recent performance.',
            'And the humbling base rate: **published edges decay.** Effects that survive publication generally survive in weakened form, because capital arrives to exploit them. A strategy from a public source should be expected to work less well than its published record, and it should be sized accordingly from day one.',
        ],
        inApp: 'The [signals queue](/signals) records every strategy signal with its reasoning, and orders carry their `strategyId` — so you can reconstruct which strategy produced which result rather than reasoning from memory about a period you were emotionally involved in.',
        quiz: [
            {
                question: 'Your live drawdown is deeper than anything in the backtest. What does that suggest?',
                options: ['Bad luck, continue', 'Evidence of a regime the strategy was not fitted to — a stop criterion, not just variance', 'The backtest was wrong', 'Increase size to recover'],
                answer: 1,
                why: 'Exceeding the worst tested drawdown means the strategy is operating outside the envelope it was validated in. That is the criterion worth setting in advance.',
            },
            {
                question: 'Why is quitting a trend-following strategy during a drawdown especially costly?',
                options: ['Exit fees', 'Its returns concentrate in a few large winners, so leaving during the drought means taking the losses and missing the recovery', 'Tax', 'It never recovers'],
                answer: 1,
                why: 'Low win rate with a high payoff ratio means the profits arrive rarely. Abandoning during the losing streak is abandoning before the winners.',
            },
        ],
    },

    {
        slug: 'paper-to-live',
        title: 'From paper to real money',
        track: 'strategy',
        level: 'expert',
        kind: 'study',
        minutes: 9,
        outcome: 'List what a paper record does and does not prove, and what changes when money is real.',
        tradeoffs: {
            pros: [
                "It tests whether your rules are complete enough to execute",
                "It shows whether the idea survives realistic costs",
                "It builds the record-keeping habit before money is at stake",
            ],
            cons: [
                "It cannot test how you behave when the loss is real, which is the thing that matters most",
                "Fills are cleaner than reality \u2014 no depth, no circuit filters, no rejections",
                "A good paper record builds confidence that has not been earned",
            ],
        },
        where: { href: '/settings', label: 'See the live-trading guard' },
        visual: {
            kind: 'split-bar',
            caption: "What a paper record proves, and what it cannot. The second half is what the first live months measure.",
            steps: [
                { label: "rules are complete", note: "tested", tone: 'up', value: 25 },
                { label: "survives costs", note: "tested", tone: 'up', value: 25 },
                { label: "you can follow a process", note: "tested", tone: 'up', value: 20 },
                { label: "how you behave with real money", note: "NOT tested", tone: 'down', value: 30 },
            ],
        },
        prereq: ['when-to-kill-a-strategy'],
        concept: [
            'A paper record is genuine evidence about some things and no evidence at all about others, and being clear about the boundary is the point of this lesson.',
            '**What it does test:** whether your rules are complete enough to execute, whether the idea survives realistic costs, whether you can follow a process for months, and whether your record-keeping is good enough to learn from.',
            '**What it does not test:** how you behave when the money is real. Paper losses do not affect your sleep, your family, or your sense of yourself. Almost every trader executes their plan better on paper than in a live account, and the gap is not small.',
            'Four mechanical things also change. **Slippage becomes real** — this simulator fills at the quoted price and models neither depth nor circuit filters, so real fills are worse. **Liquidity constrains size**, and in small caps the constraint arrives sooner than expected. **Rejections and outages happen** — orders fail, connections drop, and a strategy that assumed fills is now missing legs. And **taxes apply**, which this app does not model at all.',
            'The reasonable transition is gradual and pre-decided: **a defined slice of capital, sized so that the worst case is tolerable, with the same rules and the same record-keeping.** If the live results diverge materially from paper, the divergence itself is the most valuable data you will get — it is measuring the gap between your system and your behaviour, which no backtest can show you.',
            'This app refuses real-money routing unless `ENABLE_LIVE_TRADING` is exactly `true`, and even then every order passes through the same `place()` chokepoint with the kill switch and coach rules applied. **That guard is deliberate friction.** The step from paper to live should require a decision, not a misclick.',
        ],
        inApp: '[Settings](/settings) holds the kill switch and the coach rules. Live routing is refused unless explicitly enabled in the environment — and there is no broker connection configured by default, so the honest default state of this app is simulation.',
        quiz: [
            {
                question: 'What does a paper record NOT test?',
                options: ['Whether the rules are complete', 'Whether the idea survives costs', 'How you behave when the money is real', 'Your record-keeping'],
                answer: 2,
                why: 'Paper losses do not cost you anything that matters. Almost everyone executes their plan better on paper, and that gap is what the first live months measure.',
            },
            {
                question: 'Live results diverge materially from your paper results. What is that?',
                options: ['A failure', 'The most valuable data available — it measures the gap between your system and your behaviour', 'A data error', 'Normal and ignorable'],
                answer: 1,
                why: 'No backtest can show you that gap. Measuring it is the actual purpose of the transition, which is why the rules and record-keeping must stay identical.',
            },
        ],
    },
    // ---------------------------------------------------------------------------------
    // The twelve strategies, one lesson each.
    //
    // Each is a real rule set shipping in /strategies, and the lesson describes the same
    // mechanism the definition does — `whenItWorks` and `whenItFails` live on the
    // strategy itself, so a lesson that contradicted them would be contradicting the
    // thing it is teaching.
    //
    // The five with reachable triggers are `practice`, gated on an order the LEDGER
    // attributes to that strategy. The rest are `study`: three of the four options
    // strategies enter on a gap between implied and realised volatility, which the
    // synthetic chain has equal BY CONSTRUCTION, so a practice gate there could never be
    // completed and would be a lie dressed as rigour.
    {
        slug: 'strategy-ma-crossover',
        title: 'Moving average crossover',
        track: 'strategy',
        level: 'intermediate',
        kind: 'practice',
        minutes: 10,
        outcome: 'Run the simplest trend rule there is, and see what it costs in a range.',
        prereq: ['hypothesis-to-rules'],
        concept: [
            'Two averages of the same price, one quick and one slow. The quick one above the slow one means recent prices sit above the longer-run norm.',
            'The crossing is not a prediction. It is a **statement about the past** that happens to persist often enough to be tradeable.',
            'It gets in late and out late by construction. That is the deal: you give up the turn in exchange for capturing the middle.',
            'In a sideways market the averages tangle and cross repeatedly, and each crossing pays a spread, slippage and charges. Months of small losses funding one large win is the normal shape — not a malfunction.',
        ],
        inApp: 'Enable it from /strategies/ma-crossover on any instrument. Crypto is the easiest to watch because it never closes.',
        where: { href: '/strategies', label: 'Run the crossover' },
        visual: {
            kind: 'two-series',
            caption: 'Fast above slow is the signal. Notice how often they tangle when price goes nowhere.',
            a: 'fast average',
            b: 'slow average',
            seriesA: [100, 103, 107, 104, 101, 104, 109, 114, 118, 121],
            seriesB: [101, 102, 103, 104, 104, 104, 105, 108, 111, 115],
        },
        tradeoffs: {
            pros: [
                'Almost impossible to overfit — two parameters, both meaning something.',
                'Captures the bulk of any sustained move without needing to call the turn.',
            ],
            cons: [
                'Whipsaws relentlessly in a range, and ranges are the common case.',
                'Always late at both ends, which feels wrong every single time.',
            ],
        },
        exercise: {
            title: 'Let the crossover place an order',
            body: 'Enable **ma-crossover** on any instrument and let it trade — approve its signal on /signals, or switch the instance to automatic. This checks your order book for an order attributed to this strategy.',
            verify: v.placedByStrategy('ma-crossover'),
        },
        quiz: [
            {
                question: 'A crossover system loses small amounts for four months, then makes it all back in three weeks. What is that?',
                options: ['A broken strategy', 'The normal shape of trend following', 'Evidence of overfitting'],
                answer: 1,
                why: 'Trend systems have a low win rate and a long right tail. The months of small losses are the cost of being present for the move.',
            },
        ],
    },
    {
        slug: 'strategy-rsi-2',
        title: 'RSI(2) pullback in a trend',
        track: 'strategy',
        level: 'intermediate',
        kind: 'practice',
        minutes: 10,
        outcome: 'Combine a trend filter with a reversion trigger, and know which half fails first.',
        prereq: ['strategy-ma-crossover'],
        concept: [
            'A two-bar RSI reacts to a single sharp down day, where a fourteen-bar one barely moves.',
            'On its own that is noise. Paired with a 200-bar average that only permits buying in an uptrend, the two do genuinely different jobs: the long average decides **whether** to be involved, the short RSI decides **when**.',
            'It fails when the long-term trend breaks while you are still trading it. A 200-bar average turns slowly, so there is a window where the filter still says "uptrend" and the market has already rolled over.',
            'That window is where nearly all of its damage happens.',
        ],
        inApp: 'Available on India, US and crypto instruments from /strategies/rsi-2.',
        where: { href: '/strategies', label: 'Run RSI(2)' },
        visual: {
            kind: 'flow',
            caption: 'Two conditions doing different jobs. The slow one decides whether; the fast one decides when.',
            steps: [
                { label: 'above 200-bar average?', note: 'whether to be involved at all', tone: 'accent' },
                { label: 'RSI(2) collapses', note: 'a sharp one-day pullback', tone: 'warn' },
                { label: 'buy the dip', tone: 'up' },
                { label: 'exit on recovery', note: 'short holds by design', tone: 'accent' },
            ],
        },
        tradeoffs: {
            pros: [
                'High win rate, which makes it psychologically easy to run.',
                'Short holding periods, so capital turns over and mistakes surface quickly.',
            ],
            cons: [
                'The rare loss is large — you are buying falling prices by design.',
                'The trend filter lags, so it keeps buying into the first leg of a real reversal.',
            ],
        },
        exercise: {
            title: 'Let RSI(2) place an order',
            body: 'Enable **rsi-2** on an India, US or crypto instrument and let it trade. Verified against your order book.',
            verify: v.placedByStrategy('rsi-2'),
        },
        quiz: [
            {
                question: 'Which half of RSI(2) fails first when a bull market ends?',
                options: [
                    'The RSI trigger, because it stops firing',
                    'The 200-bar filter, because it lags and still permits buying',
                    'Neither; it exits automatically',
                ],
                answer: 1,
                why: 'The slow filter is what turns late. It keeps saying "uptrend" through the first leg down, and that is where the strategy does most of its damage.',
            },
        ],
    },
    {
        slug: 'strategy-donchian-breakout',
        title: 'Donchian channel breakout',
        track: 'strategy',
        level: 'intermediate',
        kind: 'practice',
        minutes: 9,
        outcome: 'Run the 1983 Turtle rule and understand why its simplicity is the feature.',
        prereq: ['strategy-rsi-2'],
        concept: [
            'Buy a new N-bar high, sell a new N-bar low, exit on a shorter channel. That is the whole rule.',
            'Its strength is what it **lacks**: two lookbacks, no fitted thresholds, nothing to overfit. A rule this bare either works across many markets and decades or it does not, and there is nowhere for a curve-fit to hide.',
            'It suffers badly when many instruments break out together and then all reverse — the losses arrive at the same time, which is a correlation problem rather than a strategy problem.',
        ],
        inApp: 'Available on every market from /strategies/donchian-breakout. Forex is a good place to watch it, because currency trends are long and slow.',
        where: { href: '/strategies', label: 'Run the breakout' },
        visual: {
            kind: 'ladder',
            caption: 'A new N-bar high is the entry. Everything else is exit management.',
            steps: [
                { label: '20-bar high', note: 'entry', tone: 'up', value: 5 },
                { label: 'price inside channel', note: 'do nothing', tone: 'accent', value: 3 },
                { label: '10-bar low', note: 'exit', tone: 'down', value: 1 },
            ],
        },
        tradeoffs: {
            pros: [
                'Nothing to overfit, which is rarer and more valuable than it sounds.',
                'Survived four decades of public scrutiny without being arbitraged away.',
            ],
            cons: [
                'Long losing streaks in choppy markets test anyone.',
                'Correlated breakouts mean the losses cluster.',
            ],
        },
        exercise: {
            title: 'Let the breakout place an order',
            body: 'Enable **donchian-breakout** on any instrument and let it trade. A breakout may take a while to trigger — that waiting is part of the strategy.',
            verify: v.placedByStrategy('donchian-breakout'),
        },
        quiz: [
            {
                question: 'Why is having only two parameters an advantage?',
                options: [
                    'It runs faster',
                    'There is nowhere for a curve-fit to hide, so a good backtest means more',
                    'It produces more signals',
                ],
                answer: 1,
                why: 'Every extra tuned parameter is another chance to fit noise. A rule with almost nothing to tune either works or does not.',
            },
        ],
    },
    {
        slug: 'strategy-opening-range-breakout',
        title: 'Opening range breakout',
        track: 'strategy',
        level: 'advanced',
        kind: 'practice',
        minutes: 10,
        outcome: 'Trade a session-bound rule and see why market hours become a real constraint.',
        prereq: ['strategy-donchian-breakout'],
        concept: [
            'The first minutes of a session absorb everything that happened while the market was shut — overnight news, other time zones, orders queued since yesterday.',
            'Once that burst settles, the high and low it produced are a genuinely informative level, because that is where the accumulated overnight interest was actually resolved.',
            'It fails on range-bound days, breaking the high, reversing, breaking the low, reversing again — paying spread and charges each time.',
            'This is the first strategy here where **the clock matters**. It runs only on India and US equity, and only during their sessions.',
        ],
        inApp: 'India and US only. This is where the market-hours guardrail and the square-off buffer stop being abstract: turn them on from /agents.',
        where: { href: '/strategies', label: 'Run the opening range' },
        visual: {
            kind: 'timeline',
            caption: 'The range forms first. Only then is a break of it informative.',
            steps: [
                { label: 'open', note: 'overnight news resolves', tone: 'warn' },
                { label: 'range forms', note: 'first 15-30 min', tone: 'accent' },
                { label: 'break of high', note: 'entry', tone: 'up' },
                { label: 'square off', note: 'before the close', tone: 'down' },
            ],
        },
        tradeoffs: {
            pros: [
                'A non-arbitrary level: it is where real overnight interest was resolved.',
                'Intraday by construction, so no overnight gap risk.',
            ],
            cons: [
                'Whipsaws badly on directionless days, and most days are directionless.',
                'Only trades a few hours a day, so a sample takes far longer to build.',
            ],
        },
        exercise: {
            title: 'Let the opening range place an order',
            body: 'Enable **opening-range-breakout** on an India or US instrument. It can only fire during that market’s session, so this one needs you to be around at the right time — which is itself the lesson.',
            verify: v.placedByStrategy('opening-range-breakout'),
        },
        quiz: [
            {
                question: 'Why does this strategy make the market-hours guardrail matter more than the others?',
                options: [
                    'It does not; guardrails apply equally',
                    'It only trades during a session, so an order outside one is meaningless',
                    'Because it uses more capital',
                ],
                answer: 1,
                why: 'A crypto strategy never meets a closed market. A session strategy meets one every single day, twice.',
            },
        ],
    },
    {
        slug: 'strategy-vol-targeted',
        title: 'Volatility-targeted trend',
        track: 'strategy',
        level: 'expert',
        kind: 'practice',
        minutes: 11,
        outcome: 'Run a strategy whose entry is deliberately trivial, so that all the edge sits in the sizing.',
        prereq: ['systematic-sizing'],
        concept: [
            'The entry rule is the simplest possible — hold while above a moving average — precisely so that everything interesting is in the **sizing**.',
            'Position size is set inversely to recent volatility, so a calm instrument gets a large position and a violent one a small position, holding roughly constant risk rather than constant capital.',
            'It fails because volatility measured on the past underestimates the future at exactly the wrong moments. Markets are calm right up until they are not, so it sizes **up** into the quiet before a shock.',
            'That is worth sitting with: the sizing rule that makes it good in normal conditions is the same rule that hurts it in the rare one.',
        ],
        inApp: 'Available on every market. Compare its equity curve against ma-crossover on the same instrument in /backtest — same idea, different sizing.',
        where: { href: '/backtest', label: 'Compare sizing approaches' },
        visual: {
            kind: 'gauge',
            caption: 'Constant risk, not constant capital. Calm markets get a bigger position — which is the flaw as well as the feature.',
            value: 0.62,
            unit: 'position size vs recent volatility',
        },
        tradeoffs: {
            pros: [
                'Equalises risk across instruments, so one violent name cannot dominate the book.',
                'Separates the entry question from the sizing question, which makes both easier to test.',
            ],
            cons: [
                'Sizes up into calm periods, which is exactly when a shock does most damage.',
                'Past volatility is a lagging estimate of future volatility, always.',
            ],
        },
        exercise: {
            title: 'Let the volatility-targeted rule place an order',
            body: 'Enable **vol-targeted** on any instrument and let it trade. Then compare the size it chose against what a fixed-value order would have been.',
            verify: v.placedByStrategy('vol-targeted'),
        },
        quiz: [
            {
                question: 'Why does volatility targeting hurt in a crash?',
                options: [
                    'It reduces size too aggressively',
                    'It sized up during the calm that preceded the crash',
                    'It stops trading entirely',
                ],
                answer: 1,
                why: 'Volatility is measured on the past. A long quiet stretch produces a large position, and the shock arrives while you are holding it.',
            },
        ],
    },
    {
        slug: 'strategy-buy-and-hold',
        title: 'Buy and hold, the bar everything must clear',
        track: 'strategy',
        level: 'foundation',
        kind: 'study',
        minutes: 7,
        outcome: 'Explain why the benchmark is hard to beat, and what beating it would have to mean.',
        prereq: ['hypothesis-to-rules'],
        concept: [
            'Buy once, never sell. It is not a trading strategy — it is the bar every trading strategy has to clear.',
            'Its edge is **structural rather than predictive**: it pays almost no charges, it is never out of the market during the handful of days that produce most of the return, and it cannot be talked out of a position.',
            'It takes the full drawdown, whatever that turns out to be. A strategy returning less than buy-and-hold with half the drawdown may well be the better one to live with.',
            'If your rule does not beat this, it is not a strategy. It is an expensive way to hold the asset.',
        ],
        inApp: 'Every backtest in /backtest can be compared against it directly — that comparison is the point of the screen.',
        where: { href: '/backtest', label: 'Compare against the benchmark' },
        visual: {
            kind: 'waterfall',
            caption: 'Where an active strategy has to make up ground before it is even level.',
            steps: [
                { label: 'buy and hold', tone: 'up', value: 100 },
                { label: 'charges', note: 'per round trip', tone: 'down', value: -14 },
                { label: 'time out of market', tone: 'down', value: -11 },
                { label: 'active edge needed', tone: 'accent', value: 25 },
            ],
        },
        tradeoffs: {
            pros: ['Almost no cost drag.', 'Never misses the few days that carry most of the return.'],
            cons: ['Takes the entire drawdown.', 'Requires a holding period most people overestimate their tolerance for.'],
        },
        quiz: [
            {
                question: 'Your strategy returns 12% a year against buy-and-hold’s 14%, with half the drawdown. What is it?',
                options: ['A failure — it lost to the benchmark', 'Potentially the better strategy to actually live with', 'Overfitted'],
                answer: 1,
                why: 'Return alone is not the comparison. A strategy you can hold through its worst period beats a better one you abandon.',
            },
        ],
    },
    {
        slug: 'strategy-macd-trend',
        title: 'MACD signal cross',
        track: 'strategy',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Explain what MACD measures that a plain crossover does not, and the failure that creates.',
        prereq: ['strategy-ma-crossover'],
        concept: [
            'MACD is the distance between a fast and a slow exponential average. The signal line is a smoothed version of that distance.',
            'So a crossing says the rate at which the trend is **strengthening** has itself turned. It measures acceleration, not direction.',
            'That is why it holds through shallow pullbacks that shake out a plain crossover.',
            'It has a failure of its own: because it is a difference of averages, it can cross while price goes nowhere, purely because the averages are converging.',
        ],
        inApp: 'Available on every market from /strategies/macd-trend. Running it beside ma-crossover on the same instrument shows the difference clearly.',
        where: { href: '/strategies', label: 'Compare against the plain crossover' },
        visual: {
            kind: 'decay',
            caption: 'MACD measures whether the trend is accelerating — which can turn while price is flat.',
            steps: [
                { label: 'trend accelerating', tone: 'up', value: 8 },
                { label: 'still rising, more slowly', tone: 'accent', value: 4 },
                { label: 'MACD crosses down', note: 'price has not fallen', tone: 'warn', value: 1 },
            ],
        },
        tradeoffs: {
            pros: ['Holds through shallow pullbacks better than a plain crossover.', 'Signals the loss of momentum before the loss of direction.'],
            cons: ['Can cross on converging averages while price is flat.', 'Three parameters instead of two, so more room to overfit.'],
        },
        quiz: [
            {
                question: 'What does a MACD signal cross actually measure?',
                options: ['That price crossed an average', 'That the rate of trend strengthening has turned', 'That volume changed'],
                answer: 1,
                why: 'MACD is a difference of averages and the signal line smooths it, so a cross is a statement about acceleration rather than direction.',
            },
        ],
    },
    {
        slug: 'strategy-bollinger-rsi',
        title: 'Bollinger band with RSI confirmation',
        track: 'strategy',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Explain why two weak conditions together are stronger than either alone — and when that still fails.',
        prereq: ['strategy-rsi-2'],
        concept: [
            'Bollinger bands sit a couple of standard deviations either side of a moving average, so price outside them is unusual **relative to its own recent volatility**.',
            'On its own that is a weak signal: price can ride a band for weeks in a real move.',
            'Requiring momentum exhaustion as well — statistical extension AND an RSI extreme — is what separates a pullback from the start of a trend.',
            'It still fails on a genuine breakout. Price leaves the band and keeps going, RSI stays pinned, and every entry is against a move that does not stop. This is the strategy that most reliably ruins people who only ever trade reversion.',
        ],
        inApp: 'Available on every market from /strategies/bollinger-rsi.',
        where: { href: '/strategies', label: 'Read the full rule' },
        visual: {
            kind: 'scatter',
            caption: 'Two conditions must agree. The dangerous case is when both fire and the move keeps going anyway.',
            a: 'distance outside the band',
            b: 'RSI extreme',
            seriesA: [1, 2, 2.5, 3, 3.2, 1.2, 0.5],
            seriesB: [40, 32, 25, 18, 14, 35, 50],
        },
        tradeoffs: {
            pros: ['Two independent conditions filter out most weak signals.', 'Bands adapt to each instrument’s own volatility.'],
            cons: ['A real breakout triggers it repeatedly, all the way down.', 'Reversion strategies lose slowly and then all at once.'],
        },
        quiz: [
            {
                question: 'Why require RSI confirmation as well as a band touch?',
                options: [
                    'To generate more signals',
                    'Because price can ride a band through a real trend, so extension alone does not mean exhaustion',
                    'Because RSI is more accurate',
                ],
                answer: 1,
                why: 'A band touch says price is statistically unusual. It says nothing about whether the move is finished.',
            },
        ],
    },
    {
        slug: 'strategy-iron-condor',
        title: 'Iron condor',
        track: 'strategy',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Explain a four-leg defined-risk structure and what you are actually being paid for.',
        prereq: ['options-in-this-app'],
        concept: [
            'Sell a call spread above the market and a put spread below it. You collect a credit and keep it if the index finishes between the short strikes.',
            'You are being paid for **the market staying where it is**. The risk is defined — the long wings cap it — which is what makes it a structure rather than a naked short.',
            'The trade-off is brutal in shape: you win often and small, and lose rarely and large. That is the opposite of trend following, and it is why position size matters more here than anywhere else.',
            'This one **can** be exercised on the synthetic chain in this app, because it does not depend on an implied-versus-realised gap.',
        ],
        inApp: 'Runnable from /strategies/options/iron-condor. Margin is approximated per leg with no spread benefit, so it is conservative — real brokers charge less.',
        where: { href: '/options', label: 'Look at a live chain' },
        visual: {
            kind: 'stack',
            caption: 'Four legs. The wings are what turn an unlimited risk into a defined one.',
            steps: [
                { label: 'long call (wing)', tone: 'accent', value: 1 },
                { label: 'short call', tone: 'down', value: 3 },
                { label: 'short put', tone: 'down', value: 3 },
                { label: 'long put (wing)', tone: 'accent', value: 1 },
            ],
        },
        tradeoffs: {
            pros: ['Defined risk, so a gap cannot take more than the width.', 'Profits from nothing happening, which is the common case.'],
            cons: ['Wins small and often, loses large and rarely — the shape most people size wrongly.', 'Four legs means four sets of charges.'],
        },
        quiz: [
            {
                question: 'What are you being paid for in an iron condor?',
                options: ['Direction', 'The index staying between your short strikes', 'Volatility rising'],
                answer: 1,
                why: 'It is a range bet with defined risk. Movement in either direction, far enough, is what costs you.',
            },
        ],
    },
    {
        slug: 'strategy-short-straddle',
        title: 'Short straddle, and why this app will not backtest it',
        track: 'strategy',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Explain what selling a straddle is really a bet on, and why the synthetic chain cannot test it.',
        prereq: ['strategy-iron-condor'],
        concept: [
            'Sell the call and the put at the same strike. You collect two premiums and keep them if the index barely moves.',
            'You are betting that **implied volatility is higher than what will actually happen**. That is the whole trade.',
            'Unlike the condor there are no wings, so the risk is not defined. A gap through your strike is the losing case, and it does not politely stop.',
            'Here is the honest limitation: this app can generate a synthetic option chain when it has no stored history, and a synthetic chain has implied and realised volatility equal **by construction**. A strategy whose entire premise is a gap between them can never fire on it. The backtester says so rather than reporting a silent zero.',
        ],
        inApp: 'Runnable from /strategies/options/short-straddle, but see above — real stored chain history is what would make a backtest of it mean anything, and that accumulates one trading day at a time.',
        where: { href: '/strategies/unavailable', label: 'What cannot be tested, and why' },
        visual: {
            kind: 'two-series',
            caption: 'The trade needs these two lines to differ. On a synthetic chain they are identical by construction.',
            a: 'implied volatility',
            b: 'realised volatility',
            seriesA: [20, 20, 20, 20, 20, 20],
            seriesB: [20, 20, 20, 20, 20, 20],
        },
        tradeoffs: {
            pros: ['Collects two premiums, so the profitable range is wide.', 'Time decay works for you every single day.'],
            cons: ['Undefined risk — a gap does not stop at a convenient level.', 'Cannot be honestly backtested here without real chain history.'],
        },
        quiz: [
            {
                question: 'Why can a short straddle not be tested on this app’s synthetic chain?',
                options: [
                    'The maths is not implemented',
                    'A synthetic chain has implied and realised volatility equal by construction, so the edge it trades cannot exist',
                    'Options backtesting is not supported',
                ],
                answer: 1,
                why: 'The strategy enters on a gap between implied and realised volatility. Generate the chain from one volatility number and there is no gap to find.',
            },
        ],
    },
    {
        slug: 'strategy-gamma-scalp',
        title: 'Gamma scalping',
        track: 'strategy',
        level: 'expert',
        kind: 'study',
        minutes: 9,
        outcome: 'Explain how a delta-hedged option position makes money from movement rather than direction.',
        prereq: ['strategy-short-straddle'],
        concept: [
            'Buy an option and hedge its delta with the underlying. You now have no directional exposure — but you still have **gamma**, which means your delta changes as price moves.',
            'Every time it moves you re-hedge, and each re-hedge locks in a small profit. You are being paid for movement, in either direction.',
            'What it costs you is theta: the option decays every day whether or not anything happens. The trade is only profitable if realised movement pays for that decay.',
            'So it is the mirror of the short straddle — long realised volatility, short implied — and it has the same problem here: a synthetic chain cannot express that gap.',
        ],
        inApp: 'Runnable from /strategies/options/gamma-scalp. Greeks and IV are solved by /lib/options/greeks.ts against the live NSE chain.',
        where: { href: '/options', label: 'See solved Greeks on a live chain' },
        visual: {
            kind: 'cycle',
            caption: 'Each re-hedge banks a little. Decay takes a little every day regardless.',
            steps: [
                { label: 'delta-hedged', tone: 'accent' },
                { label: 'price moves', tone: 'warn' },
                { label: 'delta drifts', note: 'gamma', tone: 'accent' },
                { label: 're-hedge', note: 'bank a small profit', tone: 'up' },
                { label: 'theta charges you', note: 'every day, regardless', tone: 'down' },
            ],
        },
        tradeoffs: {
            pros: ['Direction-neutral, so you do not have to be right about where it goes.', 'Profits from turbulence, which most strategies suffer from.'],
            cons: ['Decay is relentless and does not care whether anything happened.', 'Re-hedging costs charges every time.'],
        },
        quiz: [
            {
                question: 'What is a gamma scalper actually long?',
                options: ['Direction', 'Realised volatility', 'Time'],
                answer: 1,
                why: 'The position is delta-hedged, so direction is neutralised. It profits from movement and pays for time.',
            },
        ],
    },
    {
        slug: 'strategy-iv-skew',
        title: 'IV skew',
        track: 'strategy',
        level: 'expert',
        kind: 'study',
        minutes: 8,
        outcome: 'Explain what the shape of the volatility surface says about fear, and why it is not free money.',
        prereq: ['strategy-gamma-scalp'],
        concept: [
            'Options at different strikes do not trade at the same implied volatility. Downside puts are usually dearer than equidistant calls.',
            'That skew is not a mispricing. It is the market pricing the fact that indices fall faster than they rise, and that everyone wants the same protection at the same moment.',
            'A skew strategy sells the expensive side and buys the cheap one, betting the shape is more extreme than it should be.',
            'It is the least forgiving of the four. You are trading a second-order property of the surface, and being right about the shape while wrong about the level still loses money.',
        ],
        inApp: 'Runnable from /strategies/options/iv-skew. Like the other volatility-gap strategies, it needs real stored chain history to be testable at all.',
        where: { href: '/options', label: 'Compare IV across strikes' },
        visual: {
            kind: 'nested',
            caption: 'Puts priced above calls is the normal state, not an anomaly waiting to be harvested.',
            steps: [
                { label: 'downside puts', note: 'dearest', tone: 'down', value: 24 },
                { label: 'at the money', tone: 'accent', value: 18 },
                { label: 'upside calls', note: 'cheapest', tone: 'up', value: 15 },
            ],
        },
        tradeoffs: {
            pros: ['Trades a persistent, well-documented structural feature.', 'Direction-neutral if constructed carefully.'],
            cons: ['The skew is usually there for a good reason — it is compensation, not a gift.', 'Needs real chain history before any backtest of it means anything.'],
        },
        quiz: [
            {
                question: 'Why are downside puts usually priced at a higher implied volatility than equidistant calls?',
                options: [
                    'A pricing error in most models',
                    'Indices fall faster than they rise, and demand for protection spikes together',
                    'Because puts are less liquid',
                ],
                answer: 1,
                why: 'The skew is compensation for a real asymmetry in how markets move, plus crowded demand for the same hedge. Selling it is selling insurance, not collecting free money.',
            },
        ],
    },
];