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
        where: { href: '/backtest', label: 'Back to testing' },
        prereq: ['overfitting'],
        concept: [
            'A single backtest over all your data answers a question nobody has: *if I had known the best parameters in advance, how would this have done?* You did not know them in advance. That is the whole difficulty.',
            '**Walk-forward analysis** removes the hindsight. Optimise on a window of data, then trade the chosen parameters on the following window that the optimisation never saw. Roll both windows forward and repeat. The out-of-sample results, stitched together, are a much closer analogue of live trading, because at every point the parameters were chosen using only past data.',
            'The comparison it produces is the useful output. **In-sample versus out-of-sample degradation** tells you how much of your result was fitting. Some degradation is always expected — optimisation always captures some noise. Severe degradation, or out-of-sample results near zero, means the in-sample result was the noise.',
            'A second reading is available and often more valuable: **parameter stability across windows.** If the optimiser picks 20 in one window, 45 in the next and 12 in the third, there is no stable relationship to find. The parameter is not measuring anything persistent, and no amount of re-optimisation will fix that.',
            'Walk-forward is not a cure. It has its own hazards — repeated walk-forward runs with different window sizes and re-optimisation rules is itself a search you can overfit, at a higher level of abstraction. But it is a much harder test to pass than a single backtest, and passing a harder test is the only evidence worth having.',
        ],
        inApp: '`lib/strategies/walkForward.ts` implements this — `expandGrid`, `optimise` and `runWalkForward`, reporting in-sample and out-of-sample per fold so degradation is visible rather than hidden. It is **built and tested but not yet exposed in the UI**: [Compare strategies](/backtest) still runs a single window per invocation.',
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
        where: { href: '/portfolio', label: 'Check your concentration' },
        prereq: ['systematic-sizing'],
        concept: [
            'Six positions look diversified. If they are six Indian IT companies, they are approximately one position with extra transaction costs. **Diversification is about correlation, not count.**',
            'Correlation runs from −1 to +1. Two assets at +0.9 move together and provide almost no diversification against each other. What you are looking for is exposures that respond to *different* things — and the honest test is not "are these different companies" but "what would make all of these fall at once?"',
            'The hidden correlations are the dangerous ones because they are not visible in the position list. Six different stocks with the same currency exposure. Long equity plus short volatility — different instruments, the same bet. A strategy portfolio where every member is a trend follower, all of which lose money in a range simultaneously. **The strategy library in this app can produce exactly this**, which is why running several correlated strategies is not the same as diversifying.',
            'The point that undermines the whole comfort of correlation analysis: **correlations rise toward 1 in crises.** The diversification you measured in calm data is partly absent in the episode you built it for, because in a broad liquidation everything correlated with risk appetite is sold together. Historical correlation understates crisis correlation, reliably.',
            'What follows practically: size on the assumption that correlations will be higher than measured, count **exposures** rather than positions, and treat cash as the one holding that genuinely does not correlate with anything.',
        ],
        inApp: '[Portfolio](/portfolio) shows exposure by market, which surfaces the most common hidden concentration. `lib/strategies/portfolio.ts` computes a full correlation matrix across sleeve returns, plus the portfolio drawdown against the weighted average of the individual ones — the gap between those two **is** the diversification, measured. That engine is **not yet exposed in the UI**.',
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
        where: { href: '/settings', label: 'See the live-trading guard' },
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
];
