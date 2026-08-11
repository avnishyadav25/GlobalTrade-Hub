import type { Lesson } from '../types';

// Track: technical analysis (continuation).
//
// `reading-a-candle` and `scanner-and-rsi` already live in curriculum.ts and keep
// their slugs. These seven extend the track upward, and they inherit that track's
// existing scepticism: the candlestick lesson already tells you most published
// pattern results do not survive out of sample, and nothing here walks that back.

export const TECHNICAL_LESSONS: Lesson[] = [
    {
        slug: 'support-and-resistance',
        title: 'Support and resistance: a real effect and a circular one',
        track: 'technical',
        level: 'foundation',
        kind: 'study',
        minutes: 8,
        outcome: 'Say why levels sometimes hold, and why drawing them after the fact proves nothing.',
        where: { href: '/terminal', label: 'Look at a chart' },
        prereq: ['reading-a-candle'],
        concept: [
            'A **support** level is a price where buying has repeatedly appeared; **resistance** is where selling has. Drawn on a chart they look like the market respecting lines, which is not what is happening.',
            'There are two genuine mechanisms, and they are worth separating from the mysticism.',
            'The first is **memory of positions**. People who bought at a price and watched it fall often sell when it returns to break-even. That produces real supply at a specific level, and it is why a former support frequently becomes resistance after being broken — the buyers trapped there are waiting to get out flat.',
            'The second is **self-fulfilment through orders**. Round numbers and visible prior highs attract resting limit orders and stop losses from many participants at once. The level then holds because everyone placed orders at it, not because it had meaning beforehand.',
            'Both are real. Neither is predictive on its own, and the second one has a sharp edge: a cluster of stop-losses just below an obvious support is a pool of forced selling that larger participants can see as clearly as you can. Prices poking briefly through an obvious level and reversing is common enough to have a name.',
            'The methodological trap is **hindsight**. On any chart you can draw lines that appear to have been respected, because you are selecting the lines that worked. The honest test is to draw a level, write it down with a date, and check whether it held afterwards. Almost nobody does this, and it is the difference between a level and a story.',
        ],
        inApp: 'Draw a level on [Terminal](/terminal), then use it — set an [alert](/alerts) at it rather than watching. An alert forces you to commit to a price in advance, which is the discipline this lesson is really about.',
        quiz: [
            {
                question: 'Why does broken support often become resistance?',
                options: ['Mathematical symmetry', 'Buyers trapped at that price sell to break even when it returns', 'Exchanges enforce it', 'It does not — that is a myth'],
                answer: 1,
                why: 'It is a real supply effect from real positions. The mechanism is people getting out flat, not the chart having a memory.',
            },
            {
                question: 'What is the honest way to test whether your levels work?',
                options: ['Look at past charts', 'Write the level down with a date in advance and check it afterwards', 'Ask other traders', 'Count how many touched'],
                answer: 1,
                why: 'On a past chart you select the lines that worked. Committing in advance is the only version of the test that can fail — which is what makes it a test.',
            },
        ],
    },

    {
        slug: 'trend-and-moving-averages',
        title: 'Trend, and what a moving average can and cannot do',
        track: 'technical',
        level: 'foundation',
        kind: 'study',
        minutes: 8,
        outcome: 'Use an average as a lagging summary rather than a signal, and predict when it fails.',
        where: { href: '/backtest', label: 'Test a crossover' },
        prereq: ['support-and-resistance'],
        concept: [
            'A **moving average** is the mean of the last N closes. That is the whole definition, and everything about its behaviour follows from it.',
            'Because it averages the past, it **always lags**. A 50-period average turns well after the price does, and no amount of tuning removes that — an exponential average weights recent bars more heavily and lags less, at the cost of reacting to more noise. You are choosing a position on that trade-off, not escaping it.',
            'What an average is genuinely good at is **stating the obvious clearly**: price above a rising average is an uptrend, by a definition you can compute rather than argue about. That has value precisely because "is this a trend" otherwise dissolves into opinion.',
            'The **crossover** — fast average crossing slow — is the oldest systematic signal there is. Its behaviour is well understood: it works in trending markets, and it loses steadily in ranging ones, generating a stream of whipsaw entries that each cost a spread and a commission.',
            'This produces the defining shape of a trend-following record: **a low win rate with a high payoff ratio.** Most trades are small losses; a few large winners pay for all of them. Traders abandon these systems during the losing streaks, which is the same thing as abandoning them before the winners arrive.',
            'The practical caution: an average is a lens, not a decision. Its parameters are also the easiest thing in all of technical analysis to overfit, because there are so many to try and one of them always looks good on past data.',
        ],
        inApp: 'The **EMA crossover** strategy in the [library](/strategies) is exactly this, and [Compare strategies](/backtest) runs it at default settings against buy-and-hold. Defaults on purpose — tuning first would be choosing the winner with hindsight.',
        formulas: [
            {
                label: 'Simple moving average',
                expr: 'SMA(N) at bar i = (close[i] + close[i−1] + … + close[i−N+1]) ÷ N',
                terms: [{ sym: 'N', meaning: 'lookback — larger is smoother and slower, and there is no free choice' }],
                worked: () => 'A 50-period average of daily closes summarises ten trading weeks. It cannot turn faster than that data allows.',
            },
        ],
        quiz: [
            {
                question: 'What is the characteristic return shape of a trend-following crossover system?',
                options: ['High win rate, small wins', 'Low win rate with a few large winners paying for many small losses', 'Consistent small gains', 'Symmetrical'],
                answer: 1,
                why: 'Most trades are small whipsaw losses; the profits come from rare large trends. Abandoning the system during the losing streak means abandoning it before the winners.',
            },
            {
                question: 'When does a crossover system lose money most reliably?',
                options: ['In strong trends', 'In ranging markets — repeated false crosses, each costing spread and commission', 'At the open', 'During earnings'],
                answer: 1,
                why: 'It is a trend-following tool. In a range it produces whipsaws by construction, and no parameter choice fixes a structural mismatch.',
            },
        ],
    },

    {
        slug: 'momentum-oscillators',
        title: 'Momentum: what overbought actually means',
        track: 'technical',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Read RSI correctly and stop treating an extreme reading as a sell signal.',
        where: { href: '/scanner', label: 'Scan by RSI' },
        prereq: ['scanner-and-rsi'],
        concept: [
            '**RSI** compares the size of recent gains to the size of recent losses and maps the result onto 0–100. Above 70 is conventionally "overbought", below 30 "oversold".',
            'Those words are actively misleading, and the misreading costs money. **Overbought does not mean too high. It means rising fast.** A stock in a powerful uptrend can hold RSI above 70 for weeks, and the strategy of shorting it because "it is overbought" is a well-known way of standing in front of a trend.',
            'The correct reading is that RSI measures the **velocity** of the move, not its extremity in price. High RSI says the recent move has been one-directional. In a range, one-directional moves tend to revert; in a trend, they tend to continue. So the same reading means opposite things depending on a regime the indicator itself cannot tell you about.',
            'That is the general truth about oscillators: **they work in ranges and fail in trends**, and they cannot distinguish the two. Any use of RSI needs something else supplying the regime — a moving average, a volatility measure, a judgement.',
            '**Divergence** — price making a new high while RSI does not — is the most cited pattern here, and it deserves the honest treatment. It genuinely does precede some reversals. It also appears repeatedly during strong trends that keep going, and the failures are not remembered as clearly as the successes. It is a reason to pay attention, not a signal.',
            'A practical note that matters more than it sounds: RSI(2) and RSI(14) are different tools. Short lookbacks produce frequent extremes suited to fast mean-reversion; long ones produce rare readings. Both are "RSI" and they do not do the same job.',
        ],
        inApp: '[Scanner](/scanner) filters by live RSI, and both **RSI(2)** and **Bollinger + RSI** are in the [strategy library](/strategies). Backtest either and look at how it behaves in the trending sections versus the ranging ones.',
        quiz: [
            {
                question: 'RSI has been above 70 for three weeks. What does that mean?',
                options: ['A crash is imminent', 'The move has been fast and one-directional — in a trend that often continues', 'The stock is expensive', 'Volume is high'],
                answer: 1,
                why: 'RSI measures velocity, not extremity. Sustained high readings are what a strong uptrend looks like, which is why shorting on "overbought" alone is a known way to lose.',
            },
            {
                question: 'Why can an oscillator not be used alone?',
                options: ['It is too slow', 'It works in ranges and fails in trends, and cannot itself tell which regime it is in', 'It needs volume data', 'It only works intraday'],
                answer: 1,
                why: 'The same reading means opposite things in the two regimes. Something outside the oscillator has to supply that context.',
            },
        ],
    },

    {
        slug: 'volatility-measures',
        title: 'Volatility: sizing what you cannot predict',
        track: 'technical',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Use ATR to set stops and size positions in units of normal movement rather than round percentages.',
        where: { href: '/terminal', label: 'Size a position' },
        prereq: ['trend-and-moving-averages'],
        visual: 'risk-sizing',
        concept: [
            '**Volatility** is how much a price typically moves, and it is the most useful thing on a chart that is not the price — because it is far more predictable than direction. Volatility clusters: calm periods follow calm periods, violent ones follow violent ones. Direction has no such property.',
            '**Average True Range** measures it in price units. True range is the largest of: today\'s high minus low, high minus yesterday\'s close, and low minus yesterday\'s close — the last two included so that a gap counts as movement. ATR is the average of that over N bars.',
            'The reason it matters is **stop placement**. A 2% stop is arbitrary: on a calm large-cap it sits far outside normal noise, and on a volatile small-cap it is inside the daily range and will be hit by nothing at all. A stop at 2 × ATR means the same thing on both — outside ordinary movement, wherever ordinary happens to be.',
            'It also fixes position sizing. Risking a fixed percentage of equity per trade, with the stop set by ATR, gives **a smaller position in a volatile instrument and a larger one in a calm one** — automatically, without judgement, so that every position risks the same amount even though the instruments do not behave alike.',
            '**Bollinger Bands** apply the same idea differently: a moving average with bands at ±2 standard deviations. The bands widen when volatility rises and narrow when it falls. Price touching a band is not a signal — by construction price spends a predictable fraction of its time outside two standard deviations, so "touching the band" is normal rather than notable.',
            'One structural warning. Volatility is **not symmetric in time**: it rises fastest during falls. A stop sized on a calm month is not sized for the week the market breaks, which is precisely the week it will be tested.',
        ],
        inApp: 'Position sizing on [Terminal](/terminal) and the **volatility-targeted** and **ATR trailing** strategies in the [library](/strategies) all use this. `atr()` in `lib/indicators.ts` is the shared implementation.',
        formulas: [
            {
                label: 'ATR position sizing',
                expr: 'quantity = (equity × risk%) ÷ (ATR multiple × ATR)',
                terms: [
                    { sym: 'risk%', meaning: 'fraction of the account you accept losing if the stop is hit' },
                    { sym: 'ATR multiple', meaning: 'how many normal ranges of room the stop is given' },
                ],
                worked: () => '₹5,00,000 risking 1% is ₹5,000. With ATR ₹20 and a 2× stop, risk per share is ₹40 → 125 shares.',
            },
        ],
        quiz: [
            {
                question: 'Why is a stop at 2 × ATR better than a stop at 2%?',
                options: ['It is tighter', 'It means the same thing across instruments — outside normal movement, whatever normal is for that instrument', 'It is never hit', 'It reduces commission'],
                answer: 1,
                why: 'A fixed percentage is inside the daily noise on a volatile instrument and far outside it on a calm one. ATR normalises the distance to how that instrument actually moves.',
            },
            {
                question: 'Price touches the upper Bollinger Band. What does that tell you?',
                options: ['It will reverse', 'Very little — price spends a predictable fraction of its time beyond two standard deviations by construction', 'Volume is rising', 'A trend has started'],
                answer: 1,
                why: 'The bands are a statistical description, not a boundary. Touching them is expected behaviour rather than an event.',
            },
        ],
    },

    {
        slug: 'volume-and-its-limits',
        title: 'Volume, and the markets where it lies',
        track: 'technical',
        level: 'intermediate',
        kind: 'study',
        minutes: 7,
        outcome: 'Use volume as confirmation where it is real, and know the two markets where it is not.',
        where: { href: '/terminal', label: 'Check an instrument\'s volume' },
        prereq: ['volatility-measures'],
        concept: [
            '**Volume** is how many units changed hands. On an exchange-traded instrument it is a hard, reported number, and it is the main piece of information on a chart that is not derived from price.',
            'Its standard use is **confirmation**. A breakout on heavy volume means many participants acted; the same breakout on thin volume means few did, and is more likely to fail. A large price move on unremarkable volume is worth a second look, because something moved the price without much actually trading.',
            'Volume also has a reliable **shape within the day**: heavy at the open, thin through the middle, heavy into the close. Comparing an hour\'s volume to the same hour on previous days is meaningful; comparing it to the day\'s average is mostly measuring the time of day.',
            'Now the limits, which matter more than the uses.',
            '**Spot forex has no meaningful volume.** It is a decentralised over-the-counter market with no central exchange and no consolidated reporting. Any "volume" on a retail FX chart is that broker\'s own flow, or tick count — the number of price updates — which is a proxy for activity, not for size. Volume-based analysis in FX is analysing a number that does not measure what it claims to.',
            '**Crypto volume is real per venue and unreliable in aggregate.** Each exchange reports its own, and reported figures on smaller venues have historically included substantial wash trading, since volume rankings drive listings and attention. Binance volume for a major pair is meaningful; an aggregator total across dozens of venues is not.',
            'The general principle: **volume is trustworthy where a regulated exchange reports it and unreliable where nobody is obliged to.** Indian and US equities qualify. Spot FX does not.',
        ],
        inApp: '`seriesStore` carries volume, and **VWAP** in the [strategy library](/strategies) needs it — which is why it is offered on equity and crypto but not on spot FX. That restriction is this lesson, enforced in code.',
        quiz: [
            {
                question: 'Why is volume unreliable in spot forex?',
                options: ['Brokers hide it', 'There is no central exchange — what is shown is one broker\'s flow or a tick count, not market size', 'It is only reported weekly', 'It is reliable'],
                answer: 1,
                why: 'FX is decentralised OTC with no consolidated reporting. A retail chart\'s "volume" measures price updates or one broker\'s book, not the market.',
            },
            {
                question: 'A breakout occurs on unusually thin volume. What does that suggest?',
                options: ['A stronger move', 'Few participants acted, so it is more likely to fail', 'Nothing', 'High volatility'],
                answer: 1,
                why: 'Volume is confirmation that a move reflects broad participation. A move nobody traded into is a weaker piece of evidence than the price alone suggests.',
            },
        ],
    },

    {
        slug: 'multiple-timeframes',
        title: 'Choosing a timeframe, and why it decides your costs',
        track: 'technical',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Pick a timeframe deliberately and understand what it costs in fees, noise and attention.',
        where: { href: '/backtest', label: 'Run the same idea on two timeframes' },
        prereq: ['momentum-oscillators'],
        concept: [
            'The same instrument produces a different chart at every timeframe, and the same rules produce different results on each. This is not a detail — the timeframe is one of the highest-impact choices in a trading system and it is usually made by accident.',
            'The **signal-to-noise trade-off** is the core of it. Shorter timeframes give more observations, so a strategy accumulates statistical evidence faster. They also contain proportionally more noise, because the ratio of real information to random movement falls as you zoom in. A 1-minute chart is mostly the mechanics of order flow; a weekly chart is mostly the business.',
            '**Costs scale with frequency and returns do not.** A strategy trading 500 times a year pays 50 times the round-trip costs of one trading ten times, from the same underlying edge. Every published intraday backtest that ignores charges is describing a strategy that does not exist. This is the single most common reason a promising short-timeframe system loses money live.',
            '**Multiple-timeframe analysis** — using a higher timeframe for direction and a lower one for entry — is the standard structure and it is genuinely useful: it supplies the regime information that oscillators lack. The failure mode is looking at enough timeframes to find one that agrees with what you already wanted to do.',
            'Then the constraint nobody mentions in the strategy write-up: **your own availability.** Intraday NSE trading demands 9:15am to 3:30pm IST attention. US intraday runs to 1:30am IST. A strategy you cannot actually be present for is not a strategy you have.',
            'And an honest note about the data in this app: **NSE intraday history is about 28 days at 15-minute bars, and crypto about 10 days.** Any Sharpe ratio computed from that is noise, which is why [Compare strategies](/backtest) suppresses ratio statistics below the sample threshold instead of printing a number.',
        ],
        inApp: 'Run the same strategy at daily and 15-minute on [Compare strategies](/backtest). The daily result has real history behind it; the intraday one will show the sample-size warning — and that warning is the lesson.',
        quiz: [
            {
                question: 'A strategy trades 500 times a year instead of 10. What scales with that?',
                options: ['The edge per trade', 'The total cost — 50× the round trips from the same underlying edge', 'Accuracy', 'Nothing'],
                answer: 1,
                why: 'Costs scale with frequency and returns do not. This is the usual reason a short-timeframe backtest that ignored charges fails in live trading.',
            },
            {
                question: 'What is the failure mode of multiple-timeframe analysis?',
                options: ['It is too slow', 'Looking at enough timeframes to find one that agrees with what you already wanted to do', 'It needs volume', 'It only works in trends'],
                answer: 1,
                why: 'With enough charts, one always confirms the trade. The discipline is deciding which timeframes matter before looking, not after.',
            },
        ],
    },

    {
        slug: 'why-patterns-fail',
        title: 'Why most published pattern results do not survive',
        track: 'technical',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Name the four specific ways a chart-pattern study fools its author, and test for each.',
        where: { href: '/backtest', label: 'Test something yourself' },
        prereq: ['multiple-timeframes'],
        concept: [
            'Technical analysis contains genuinely useful ideas — volatility clusters, trends persist, costs matter — and a very large body of published pattern results that do not replicate. It is worth being precise about *how* the failures happen, because the same four mechanisms explain nearly all of them, and each one is testable.',
            '**Selection on the outcome.** Patterns are usually defined loosely enough that whether one occurred is decided partly by whether it worked. "Head and shoulders" has no formal specification — shoulder symmetry, neckline slope, and depth are all judgement calls. On a past chart you find the instances that preceded a decline, because those are the ones that look like the pattern. **Test:** write the definition as code that a computer can apply, then run it. Patterns that cannot be specified precisely enough to code cannot be tested, and an untestable claim is not evidence.',
            '**Multiple comparisons.** Try a hundred parameter combinations on the same data and roughly five will look significant at the 5% level purely by chance. Published results are the survivors of an unreported search — and the search is almost never reported.',
            '**Survivorship in the data.** Backtesting today\'s index constituents over ten years silently excludes every company that failed or was delisted. The universe was chosen by the outcome, and the resulting return is biased upward by an amount that is easy to underestimate.',
            '**Ignoring costs.** Already covered, and it remains the most common single error. A pattern with a small statistical edge is profitable on paper and unprofitable after spread, commission, STT and slippage.',
            'The scepticism cuts both ways, though, and it would be dishonest to stop here. Some effects **have** survived rigorous out-of-sample testing across decades and markets: cross-sectional momentum, post-earnings-announcement drift, and short-term reversal are the most studied. They persist in weakened form after publication — the edge shrinks as it is exploited, which is what you would expect if it were real.',
            'The distinction is not "technical versus fundamental". It is **testable versus untestable, and tested versus asserted.** That is the standard this whole app is built to — which is why [Compare strategies](/backtest) shows buy-and-hold on every run and suppresses statistics computed from too few trades.',
        ],
        inApp: 'Everything in the [strategy library](/strategies) is coded, so every claim about it is testable. Each backtest reports its benchmark and hides ratio statistics below 30 trades — because a Sharpe from eight trades is a number, not a result.',
        quiz: [
            {
                question: 'Why is "head and shoulders" hard to evaluate honestly?',
                options: ['It is too rare', 'It has no formal specification, so instances are partly identified by whether they worked', 'It only appears intraday', 'It needs volume data'],
                answer: 1,
                why: 'Loose definitions let the outcome influence the classification. Coding the definition removes that, and a pattern that cannot be coded cannot be tested.',
            },
            {
                question: 'You test 100 parameter combinations and 5 are significant at the 5% level. What have you found?',
                options: ['Five real edges', 'Exactly what pure chance predicts — this is the multiple-comparisons problem', 'A robust strategy', 'A data error'],
                answer: 1,
                why: '5% of 100 is 5. Published results are typically the survivors of an unreported search, which is why out-of-sample testing exists.',
            },
            {
                question: 'Which effects have survived decades of out-of-sample testing?',
                options: ['None', 'Cross-sectional momentum, post-earnings drift and short-term reversal — weakened after publication, but persistent', 'All chart patterns', 'Only fundamental analysis'],
                answer: 1,
                why: 'The distinction is testable versus untestable, not technical versus fundamental. Edges that shrink after publication behave exactly as real, exploited edges should.',
            },
        ],
    },
];
