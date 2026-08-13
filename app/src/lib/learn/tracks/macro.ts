import type { Lesson } from '../types';

// Track: news, macro and calendars.
//
// The through-line is that markets price expectations, so news moves price only to
// the extent it differs from what was expected. Every lesson here is an application
// of that one idea, which is also why "good news, price fell" stops being a paradox.

export const MACRO_LESSONS: Lesson[] = [
    {
        slug: 'how-news-is-priced',
        title: 'Why good news makes prices fall',
        track: 'macro',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Explain the surprise mechanism, and stop trading headlines you read after the move.',
        where: { href: '/insights', label: 'Back to insights' },
        visual: {
            kind: 'flow',
            caption: "Excellent results, slightly less excellent than expected, is bad news. What trades is the surprise.",
            steps: [
                { label: "consensus forms", note: "and is priced in", tone: 'accent' },
                { label: "the number lands", note: "30% growth", tone: 'up' },
                { label: "versus 35% expected", note: "the surprise is negative", tone: 'down' },
                { label: "the stock falls", note: "on good results", tone: 'warn' },
            ],
        },
        concept: [
            'The most common confusion in markets is why a company reports excellent results and the stock falls, or a country posts strong growth and its currency weakens. It resolves with one idea: **markets price expectations, and news moves price only to the extent that it differs from what was expected.**',
            'By the time a scheduled announcement arrives, the consensus is already in the price. What trades on the release is **actual minus expected** — the surprise. Excellent results that were slightly less excellent than expected are, in market terms, bad news.',
            'This is why "buy the rumour, sell the news" persists as a description. Anticipation is what moves price; the confirmation of what was anticipated is when positioning unwinds.',
            'The second-order effect matters as much and is less discussed. **The market prices not just the event but the reaction to it.** A rate cut that was fully expected can be met with a fall if the accompanying commentary is more cautious than the cut implied. What is being priced is the whole information set, not the headline number.',
            'What follows practically for anyone reading news is uncomfortable and worth stating plainly. **By the time you read a headline, the move has happened.** Professional participants have direct feeds and automated reactions measured in milliseconds. Retail news trading is generally trading the aftermath — reacting to the second-order move without knowing what the first-order one was.',
            'The defensible uses of news are different in kind: understanding *why* something moved so you can judge whether your thesis survived, and positioning **ahead** of scheduled events with a view about the surprise — which is a research activity, not a reaction.',
        ],
        inApp: '[Research](/research) shows real earnings dates with actual-versus-estimate EPS. That surprise figure — not the headline result — is what the **PEAD** strategy in the [library](/strategies) trades.',
        quiz: [
            {
                question: 'A company beats expectations and the stock falls. What is the most likely explanation?',
                options: ['Market irrationality', 'Guidance or commentary disappointed, or the beat was smaller than the whisper — what trades is actual minus expected', 'Accounting fraud', 'Short selling'],
                answer: 1,
                why: 'Consensus is priced in advance. Excellent results slightly below what was expected are bad news in market terms.',
            },
            {
                question: 'You read a headline about a market move. What is the practical implication?',
                options: ['Trade it immediately', 'The move has already happened — professionals react in milliseconds, so you would be trading the aftermath', 'It will reverse', 'It will continue'],
                answer: 1,
                why: 'Retail news trading is reacting to a second-order move without having seen the first. The defensible uses are understanding why, and positioning ahead of scheduled events.',
            },
        ],
    },

    {
        slug: 'central-banks',
        title: 'Central banks: the biggest single variable',
        track: 'macro',
        level: 'intermediate',
        kind: 'study',
        minutes: 9,
        outcome: 'Explain the transmission from a policy rate to asset prices, and read a policy statement.',
        where: { href: '/insights', label: 'Back to insights' },
        visual: {
            kind: 'flow',
            caption: "Why high-growth companies fall hardest when rates rise. It is arithmetic, not sentiment.",
            steps: [
                { label: "policy rate rises", tone: 'warn' },
                { label: "discount rate rises", note: "applied to future cash flows", tone: 'accent' },
                { label: "distant profits", note: "discounted hardest", tone: 'down' },
                { label: "growth stocks", note: "fall most", tone: 'down' },
            ],
        },
        prereq: ['how-news-is-priced'],
        concept: [
            'Central banks set the price of money, and the price of money is the input to the valuation of every other asset. That makes policy decisions the largest recurring scheduled events in markets.',
            'The **transmission** runs through several channels at once. A higher policy rate raises borrowing costs, which slows economic activity and reduces corporate profits. It raises the return on cash and government bonds, which makes every risk asset less attractive by comparison. And it raises the discount rate used to value future cash flows — which mechanically reduces the present value of anything whose profits are far in the future.',
            'That third channel explains a pattern that otherwise looks arbitrary. **High-growth companies fall hardest when rates rise**, because more of their value sits in distant cash flows and distant cash flows are discounted hardest. It is arithmetic, not sentiment.',
            'The vocabulary is worth knowing because it is used precisely. **Hawkish** means favouring higher rates to control inflation; **dovish** means favouring lower rates to support growth. **Quantitative easing** is a central bank buying bonds to push long-term yields down when the policy rate is already near zero; **tightening** is the reverse.',
            'What actually moves markets on decision day is rarely the decision, which is usually anticipated. It is the **statement and the projections** — the guidance about what comes next. Markets trade the expected path of rates, not the current level, so a hold accompanied by hawkish language can move more than a cut.',
            'For an Indian investor there are **two** central banks that matter. The RBI sets domestic rates and manages the rupee. The US Federal Reserve sets the global cost of capital and drives foreign flows into and out of Indian assets — which is why Indian markets can move sharply on a decision taken in Washington.',
        ],
        inApp: 'This app has no macro data feed and no economic calendar. This lesson is context for interpreting what you see, not something the app computes.',
        quiz: [
            {
                question: 'Why do high-growth companies fall hardest when rates rise?',
                options: ['They carry more debt', 'More of their value sits in distant cash flows, which are discounted hardest', 'They are more volatile', 'Investors panic'],
                answer: 1,
                why: 'Discounting is arithmetic. A higher rate reduces the present value of far-future profits more than near-term ones, which is the whole mechanism.',
            },
            {
                question: 'Which central bank matters to an Indian equity investor?',
                options: ['Only the RBI', 'Both the RBI and the US Federal Reserve — the Fed drives global capital flows into and out of Indian assets', 'Only the Fed', 'Neither'],
                answer: 1,
                why: 'The RBI sets domestic rates; the Fed sets the global cost of capital. Indian markets move on decisions taken in Washington for exactly that reason.',
            },
        ],
    },

    {
        slug: 'inflation-and-growth-data',
        title: 'Inflation and growth prints: what the numbers mean',
        track: 'macro',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Read the main economic releases and know which components the market cares about.',
        where: { href: '/insights', label: 'Back to insights' },
        visual: {
            kind: 'split-bar',
            caption: "Headline includes food and energy. Core excludes them, and core is what policy responds to.",
            steps: [
                { label: "core", note: "services, wages, rent \u2014 persistent", tone: 'accent', value: 65 },
                { label: "food and energy", note: "volatile, weather and geopolitics", tone: 'warn', value: 35 },
            ],
        },
        prereq: ['central-banks'],
        concept: [
            'A handful of scheduled releases move markets more than all the commentary between them, and each has a component that matters more than the headline.',
            '**Inflation** — CPI in India, CPI and PCE in the US. The headline figure includes food and energy, which are volatile and often driven by weather or geopolitics rather than by the economy. **Core inflation**, which excludes them, is what central banks respond to because it is a better read on persistent price pressure. A headline print driven entirely by vegetable prices is a different signal from one driven by services.',
            '**Employment** — the US non-farm payrolls release is among the most market-moving scheduled events in the world, because employment drives consumption and wage growth feeds inflation. Wage growth within the release often matters more than the job count.',
            '**Growth** — GDP, released quarterly and heavily revised. Because it is backward-looking by a quarter, markets often care more about forward-looking surveys such as purchasing managers\' indices, which arrive monthly and lead rather than lag.',
            'Two structural points that change how you should read all of them. **Revisions are substantial** — an initial print is an estimate and can be revised enough to reverse its message, and the revision usually gets a fraction of the attention the original did. And **the same number means different things in different regimes**: strong employment is good news when growth is the concern and bad news when inflation is, because it implies the central bank must stay restrictive.',
            'That regime dependence is why "good data, market fell" recurs. The market is not reacting to the economy; it is reacting to what the data implies about policy.',
        ],
        inApp: 'No economic data feeds are wired into this app, and none are planned in the current phases. The [Research](/research) screen covers company-level and IPO data only.',
        quiz: [
            {
                question: 'Why do central banks focus on core rather than headline inflation?',
                options: ['It is easier to compute', 'It excludes volatile food and energy, so it reads persistent price pressure rather than weather and geopolitics', 'It is always lower', 'Regulation'],
                answer: 1,
                why: 'A headline print driven by vegetable prices carries different policy implications from one driven by services. Core isolates the part policy can affect.',
            },
            {
                question: 'Strong employment data causes markets to fall. What regime are you in?',
                options: ['A growth scare', 'An inflation regime — strong employment implies the central bank must stay restrictive', 'A currency crisis', 'It is a data error'],
                answer: 1,
                why: 'The market reacts to what data implies about policy, not to the economy directly. The same number flips meaning as the dominant concern changes.',
            },
        ],
    },

    {
        slug: 'economic-calendar',
        title: 'Trading around scheduled events',
        track: 'macro',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Plan around known events rather than being surprised by them.',
        where: { href: '/research', label: 'Check the earnings calendar' },
        visual: {
            kind: 'timeline',
            caption: "A large share of volatility is scheduled. Being surprised by it is a planning failure, not bad luck.",
            steps: [
                { label: "before", note: "ranges narrow, IV rises", tone: 'warn' },
                { label: "release", note: "a violent, often false, first move", tone: 'down' },
                { label: "minutes later", note: "the detail is read", tone: 'accent' },
                { label: "after", note: "IV collapses", tone: 'up' },
            ],
        },
        prereq: ['how-news-is-priced'],
        concept: [
            'A large share of market volatility is **scheduled**. Central bank decisions, inflation releases, employment data, earnings dates, index rebalancing, expiry days — all published in advance, all knowable.',
            'That means being surprised by a scheduled event is a planning failure rather than bad luck. The minimum discipline is to know what is coming this week for the instruments you hold.',
            'Behaviour around these events follows a recognisable pattern. **Before**: volume thins as participants wait, ranges narrow, and implied volatility rises because options must cover the event. **During**: a violent move, often with a false first direction as automated systems react to the headline before the detail is parsed. **After**: implied volatility collapses, and the move either persists or fully reverses within the session.',
            'The false first move deserves emphasis. Reacting in the first seconds means competing with automated systems on their terms; the initial spike frequently reverses once the full release is read. Waiting for the dust to settle costs you the first move and saves you the wrong one.',
            'Three defensible approaches, and they are genuinely different activities. **Avoid** — flatten before the event, accepting that you will miss the move; entirely reasonable if your edge is not in event pricing. **Position ahead** — take a view on the surprise, sized for the possibility of being wrong, accepting gap risk. **Trade the aftermath** — wait for the release, let the initial reaction resolve, and trade the established direction with much better information.',
            'What is not defensible is holding a large leveraged position through a scheduled event **without having decided to**. A gap through your stop is not a risk you managed; it is one you did not look at.',
        ],
        inApp: '[Research](/research) serves the real Finnhub earnings calendar — over a thousand upcoming events with dates and estimates — so equity event dates are checkable in the app. There is no macro calendar here.',
        quiz: [
            {
                question: 'What typically happens to implied volatility immediately after a scheduled event?',
                options: ['It rises further', 'It collapses — the uncertainty it was pricing has resolved', 'It stays flat', 'It becomes negative'],
                answer: 1,
                why: 'IV prices uncertainty about the event. Once the event happens the uncertainty is gone, which is the volatility crush that catches option buyers.',
            },
            {
                question: 'Why is the first move after a release often misleading?',
                options: ['Data errors', 'Automated systems react to the headline before the detail is parsed, and the initial spike frequently reverses', 'Exchanges delay it', 'It is not'],
                answer: 1,
                why: 'Reacting in the first seconds means competing with automation on its terms. Waiting costs the first move and avoids the wrong one.',
            },
        ],
    },

    {
        slug: 'india-macro',
        title: 'The Indian macro calendar',
        track: 'macro',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Name the domestic drivers that do not appear in international macro coverage.',
        where: { href: '/terminal', label: 'Watch USD/INR' },
        visual: {
            kind: 'flow',
            caption: "One external variable feeding three domestic ones at once \u2014 the clearest link between a commodity and Indian equity.",
            steps: [
                { label: "crude rises", note: "India imports most of it", tone: 'warn' },
                { label: "trade deficit widens", tone: 'down' },
                { label: "rupee under pressure", tone: 'down' },
                { label: "inflation up", note: "RBI room to cut shrinks", tone: 'down' },
            ],
        },
        prereq: ['inflation-and-growth-data'],
        concept: [
            'Indian markets respond to a set of domestic events that generic macro coverage does not cover, and several have no equivalent elsewhere.',
            '**The RBI monetary policy committee** meets on a published schedule. Beyond the repo rate, the liquidity stance and any commentary on the rupee move markets — and because the RBI actively manages the currency, its signals about intervention matter to anyone holding foreign-currency exposure.',
            '**The Union Budget**, presented on 1 February, is a far larger market event in India than a national budget is in most countries. Tax rates on capital gains, STT, customs duties, sector allocations and the fiscal deficit target all arrive at once, and sector-specific announcements produce large single-day moves. It is also the day tax rules for traders change — which is why every tax lesson in this course points at the primary source instead of quoting a number.',
            '**FII and DII flows.** Foreign institutional investors have historically driven large directional moves in Indian equity, with domestic institutions increasingly acting as the offsetting buyer. The aggregate figures are published daily by the exchanges. **This app cannot fetch them — NSE blocks programmatic access, verified 403** — which is why the FII/DII strategy is listed as not built rather than approximated.',
            '**The monsoon.** Genuinely a market variable in India in a way that surprises outsiders. Rainfall affects agricultural output, rural consumption, food inflation and therefore the RBI\'s room to cut rates. A poor monsoon transmits into sectors that appear unrelated to agriculture.',
            '**Crude oil**, because India imports most of its requirement. A rising crude price widens the trade deficit, pressures the rupee, and raises inflation — one external variable feeding three domestic ones simultaneously. This is the clearest single link between a commodity price and the Indian equity market.',
        ],
        inApp: '`USD/INR` is live in this app and load-bearing — `deriveFxRates()` prices the whole rupee book from it. The macro drivers above are what move it.',
        quiz: [
            {
                question: 'Why does a rising crude oil price pressure Indian markets?',
                options: ['Indian companies produce oil', 'India imports most of its crude — so it widens the trade deficit, pressures the rupee and raises inflation at once', 'It only affects energy stocks', 'It does not'],
                answer: 1,
                why: 'One external variable feeds three domestic ones simultaneously. It is the clearest single link between a commodity price and Indian equity.',
            },
            {
                question: 'Why does this app not show FII/DII flow data?',
                options: ['It is not useful', 'NSE blocks programmatic access — verified 403 — so the strategy is listed as not built rather than approximated', 'It costs too much', 'It is not published'],
                answer: 1,
                why: 'The data is published but not programmatically reachable. Approximating it with something else would be presenting a proxy as the real thing.',
            },
        ],
    },

    {
        slug: 'reading-news-critically',
        title: 'Reading financial news without being farmed by it',
        track: 'macro',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Identify the incentives behind a piece of market coverage before acting on it.',
        where: { href: '/learn', label: 'Back to the track' },
        visual: {
            kind: 'cycle',
            caption: "The daily explanation is written after the close, by selecting a plausible cause from that day\\u2019s headlines.",
            steps: [
                { label: "market moves", note: "for many unobservable reasons", tone: 'accent' },
                { label: "a cause is chosen", note: "from today\\u2019s headlines", tone: 'warn' },
                { label: "the story is published", note: "as though it were measured", tone: 'down' },
                { label: "you read it", note: "and believe it explains" },
            ],
        },
        prereq: ['how-news-is-priced'],
        concept: [
            'Financial media is a business, and its product is attention rather than accuracy. That is not a conspiracy — it is an incentive structure, and knowing it changes how you read.',
            '**Narrative is applied after the fact.** Markets move for many reasons at once, most unobservable. The daily explanation — "stocks fell on inflation concerns" — is written after the close by someone selecting a plausible cause from that day\'s available headlines. It is a story about a number, not a finding.',
            '**Prediction is entertainment.** Forecasts are made constantly, rarely tracked, and never scored. The few studies that have systematically checked pundit accuracy have found it close to chance. A confident forecast on television carries no accountability, which is precisely why it can be delivered confidently.',
            '**Everyone quoted has a position.** A fund manager describing an attractive opportunity usually owns it. An analyst has an employer with banking relationships. Someone recommending a stock on social media may be selling into your buying. Disclosure requirements exist, are imperfectly followed, and the absence of a disclosure is not evidence of the absence of a position.',
            '**Survivorship dominates coverage.** The trader who returned 400% is interviewed; the thousand who tried the same approach and lost are not. Every "how I did it" story is drawn from the surviving tail, which makes the strategy look far more reliable than it was.',
            'What to do instead is boring and effective. **Prefer primary sources** — the filing, not the article about the filing; the RBI statement, not the summary. **Ask what would have to be true** for a claim to hold. **Notice the timeframe** a claim is made over. And **be most sceptical of what confirms your position**, because that is what you will accept without checking.',
            'One reliable tell across all of it: **urgency**. "Act now", "last chance", "before it takes off" exists to prevent you from checking. Real opportunities survive a day of due diligence, and anything that does not was not one.',
        ],
        inApp: 'This app deliberately contains no news feed and no sentiment scoring. The plan lists FOMC NLP and dark-pool sentiment as **not built** — there is no real-time feed available, and inventing one would be the exact defect this codebase is built to avoid.',
        quiz: [
            {
                question: 'How is the daily "markets fell because…" explanation produced?',
                options: ['From exchange data on causes', 'Written after the close by selecting a plausible cause from that day\'s headlines', 'From a survey of traders', 'By the regulator'],
                answer: 1,
                why: 'Markets move for many unobservable reasons at once. The narrative is a story fitted to the number afterwards, not a measurement of cause.',
            },
            {
                question: 'Which claim should you be most sceptical of?',
                options: ['One that contradicts your position', 'One that confirms your position — that is what you will accept without checking', 'A neutral one', 'An old one'],
                answer: 1,
                why: 'Confirming information passes unexamined, which is exactly what makes it dangerous. Scepticism is cheapest to apply where it is least comfortable.',
            },
        ],
    },
];
