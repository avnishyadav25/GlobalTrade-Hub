import type { Lesson } from '../types';

// Track: other markets.
//
// Bonds, funds and allocation. None of these are tradeable in this app, and that is
// deliberate rather than a gap: this is a trading simulator, and the most useful
// thing this track can do is explain what the instruments most people should
// actually own do — and why they are not here.

export const OTHER_MARKET_LESSONS: Lesson[] = [
    {
        slug: 'bonds-basics',
        title: 'Bonds: lending, and why the price moves',
        track: 'other-markets',
        level: 'foundation',
        kind: 'study',
        minutes: 8,
        outcome: 'Explain the inverse price-yield relationship and why long bonds move more.',
        where: { href: '/portfolio', label: 'Think about allocation' },
        visual: {
            kind: 'two-series',
            caption: "Price and yield move in opposite directions, mechanically. The coupon never changed \u2014 the price did all the adjusting.",
            a: "bond price",
            b: "market yield",
            seriesA: [1000, 980, 955, 930, 910],
            seriesB: [5.0, 5.4, 5.9, 6.4, 6.8],
        },
        concept: [
            'A bond is a loan you can trade. You lend a fixed sum, receive periodic interest — the **coupon** — and get the principal back at **maturity**. Governments and companies both issue them, and the government bond market is far larger than the equity market almost everywhere.',
            'The single fact that unlocks bonds: **price and yield move in opposite directions, mechanically.** A bond paying ₹50 a year on ₹1,000 yields 5%. If new bonds are issued at 6%, nobody will pay ₹1,000 for a 5% coupon — the price falls until the fixed ₹50 represents a competitive yield. The coupon never changed; the price did all the adjusting.',
            'This is why **rising interest rates cause bond losses**, and it surprises people who bought bonds because they were "safe". Safe here means the issuer will very likely pay you back at maturity. It does not mean the price will not fall meaningfully in the meantime.',
            '**Duration** measures how much. It is roughly how many years, weighted by cash flows, until you get your money back — and it works as a sensitivity: a bond with duration 8 loses roughly 8% of its value for a 1 percentage point rise in yields. **Long-dated bonds are far more volatile than short-dated ones**, which is the main risk dial in a bond portfolio and is chosen rather than inherited.',
            'Two risks sit alongside. **Credit risk** — the issuer may not pay — is why corporate bonds yield more than government bonds, and the extra yield is called the spread. **Inflation risk** is more insidious: a fixed coupon loses purchasing power, so a nominally safe bond can be a real-terms loss over a decade.',
        ],
        inApp: '**This app does not trade bonds.** They are here because an allocation decision cannot be made sensibly without knowing what the alternative to equity actually does.',
        formulas: [
            {
                label: 'Duration as sensitivity',
                expr: 'price change ≈ − duration × change in yield',
                terms: [{ sym: 'duration', meaning: 'cash-flow-weighted average time to repayment, in years' }],
                worked: () => 'Duration 8, yields rise 1% → roughly −8% price. The same rise costs a duration-2 bond about 2%.',
            },
        ],
        quiz: [
            {
                question: 'Interest rates rise. What happens to existing bond prices?',
                options: ['They rise', 'They fall — the fixed coupon must be repriced to compete with new higher-yielding issues', 'No change', 'Only corporate bonds fall'],
                answer: 1,
                why: 'The coupon is fixed, so the price is the only thing that can adjust. This is mechanical, not sentiment, and it is why "safe" bonds lose money in a rate rise.',
            },
            {
                question: 'Which bond falls more when yields rise 1%?',
                options: ['A 2-year bond', 'A 20-year bond — longer duration means greater sensitivity', 'They fall equally', 'Neither falls'],
                answer: 1,
                why: 'Duration is the sensitivity dial. It is chosen when you pick a maturity, which makes it the main risk decision in a bond portfolio.',
            },
        ],
    },

    {
        slug: 'yield-curve',
        title: 'The yield curve and what its shape has predicted',
        track: 'other-markets',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Read a yield curve and state honestly what an inversion has and has not signalled.',
        where: { href: '/insights', label: 'Back to insights' },
        prereq: ['bonds-basics'],
        visual: 'yield-curve',
        concept: [
            'Plot government bond yields against their maturities and you get the **yield curve** — one of the most watched objects in finance, because it summarises what the market expects rates to do.',
            'The **normal** shape slopes upward: longer lending pays more, compensating for inflation uncertainty and the risk of being locked in. A **flat** curve says the market expects little change. An **inverted** curve — short rates above long ones — says the market expects rates to *fall*, which usually means it expects economic weakness.',
            'Inversion has a strong empirical record. In the United States, **an inverted curve has preceded most recessions of the past several decades**, which is why it receives the attention it does.',
            'The qualifications matter as much as the record, and they are usually omitted. The **lag is long and variable** — often a year or more between inversion and recession, which is useless for timing anything. The **sample is small**: a handful of recessions is not a large statistical base, however clean the pattern looks. There have been **false signals**. And the curve is now heavily influenced by central bank bond buying, which means the mechanism that made it informative may not be operating as it did.',
            'It also travels poorly. The relationship is documented mainly for the US, and India\'s curve is shaped by domestic liquidity, RBI operations and a different investor base. Reading an Indian inversion with American priors is not supported by the evidence.',
            'The honest framing: **the yield curve is information about expectations, not a forecast you can trade.** By the time it inverts, the expectation is priced into everything else too.',
        ],
        inApp: 'This app has no bond data and does not display a yield curve. The animation above is illustrative and is labelled as such — it is not live data.',
        quiz: [
            {
                question: 'What does an inverted yield curve directly tell you?',
                options: ['A recession is certain', 'The market expects rates to fall, which usually means it expects weakness — with a long and variable lag', 'Bonds are cheap', 'Inflation is rising'],
                answer: 1,
                why: 'It is a statement about expectations. The recession link is real but the lag is often more than a year, which makes it useless for timing.',
            },
            {
                question: 'Why treat the US inversion record cautiously elsewhere?',
                options: ['The data is unavailable', 'Small sample, false signals, central-bank distortion, and a relationship documented mainly for the US', 'Other countries have no bonds', 'It works better elsewhere'],
                answer: 1,
                why: 'India\'s curve is shaped by domestic liquidity and RBI operations. Importing American priors is not supported by the evidence.',
            },
        ],
    },

    {
        slug: 'etfs-and-index-funds',
        title: 'Index funds and ETFs: the boring answer that usually wins',
        track: 'other-markets',
        level: 'foundation',
        kind: 'study',
        minutes: 8,
        outcome: 'Explain why cost dominates fund selection, and what an ETF adds over an index fund.',
        where: { href: '/portfolio', label: 'Compare to your own record' },
        visual: {
            kind: 'two-series',
            caption: "A 1% annual cost difference over twenty years. Same portfolio, same manager \u2014 direct versus regular.",
            a: "direct plan",
            b: "regular plan",
            seriesA: [100, 112, 125, 140, 157, 176, 197, 221, 247, 277],
            seriesB: [100, 111, 123, 136, 151, 167, 185, 205, 227, 251],
        },
        concept: [
            'An **index fund** holds every constituent of an index in proportion, aiming to match it rather than beat it. An **ETF** does the same thing in a form that trades on an exchange like a share.',
            'The case for them is uncomfortable for a trading app to state, and it is stated anyway because it is true: **across markets and over long horizons, most actively managed funds have underperformed their benchmark after fees**, and the ones that outperform in one period are largely not the ones that outperform in the next. SPIVA and similar scorecards have shown this repeatedly, including for Indian large-cap funds.',
            'The mechanism is arithmetic before it is skill. All investors collectively hold the market, so before costs the average actively managed rupee earns the market return. After fees, it earns less. **The average active investor must underperform the index by roughly the fees charged** — that is not an empirical finding, it is a consequence of the arithmetic.',
            'So the dominant variable in fund selection is **cost**, and it compounds. A 1% annual difference in expense ratio compounds to roughly a 20% difference in terminal wealth over 20 years at typical returns. In India this shows up most clearly in **direct versus regular** plans: the regular plan embeds a distributor commission, and the direct plan of the same fund does not. Same portfolio, same manager, different return, forever.',
            'ETF versus index fund is a smaller decision. An **ETF** trades intraday, can be bought at a discount or premium to net asset value, and needs a demat account. An **index fund** transacts once daily at NAV, supports automatic monthly investment easily, and has no bid-ask spread. For regular monthly investing the index fund is usually simpler; for a lump sum in a liquid ETF the ETF is usually cheaper.',
            'A caution specific to Indian ETFs: **check liquidity before buying.** Thinly traded ETFs can show wide spreads and prices that diverge noticeably from NAV, which quietly undoes the cost advantage that made you choose one.',
        ],
        inApp: 'This app does not hold funds. But [Portfolio](/portfolio) gives you the honest comparison that matters: your own paper record, with real charges, against buy-and-hold — which is the same question this lesson asks about professional managers.',
        formulas: [
            {
                label: 'Why cost dominates',
                expr: 'terminal wealth ratio = ((1 + r − c₁) ÷ (1 + r − c₂))^years',
                terms: [{ sym: 'c', meaning: 'annual cost as a fraction' }],
                worked: () => 'A 1% annual cost difference over 20 years at 12% returns is roughly a 20% gap in final wealth, from fees alone.',
            },
        ],
        quiz: [
            {
                question: 'Why must the average actively managed rupee underperform the index?',
                options: ['Managers lack skill', 'Arithmetic — all investors collectively hold the market, so the average earns the market return before costs and less after', 'Index funds are better run', 'Regulation'],
                answer: 1,
                why: 'This is a consequence of accounting, not an empirical claim about skill. It is why cost is the dominant controllable variable in fund selection.',
            },
            {
                question: 'What is the difference between a direct and a regular mutual fund plan in India?',
                options: ['Different portfolios', 'Same portfolio and manager; the regular plan embeds a distributor commission, permanently reducing your return', 'Different risk levels', 'Direct plans are riskier'],
                answer: 1,
                why: 'Identical fund, different expense ratio. The gap compounds for as long as you hold, which makes it one of the highest-value decisions available to a retail investor.',
            },
        ],
    },

    {
        slug: 'reits-and-invits',
        title: 'REITs and InvITs: property and infrastructure, in units',
        track: 'other-markets',
        level: 'intermediate',
        kind: 'study',
        minutes: 7,
        outcome: 'Say what you own, and why the distribution yield is not a coupon.',
        where: { href: '/portfolio', label: 'Back to portfolio' },
        visual: {
            kind: 'flow',
            caption: "A distribution yield is not a coupon. Rate rises hit a REIT from both directions at once.",
            steps: [
                { label: "rates rise", tone: 'warn' },
                { label: "borrowing costs up", note: "the trust pays more", tone: 'down' },
                { label: "yield less attractive", note: "against risk-free", tone: 'down' },
                { label: "unit price falls", note: "both effects compound", tone: 'down' },
            ],
        },
        prereq: ['bonds-basics'],
        concept: [
            'A **REIT** — real estate investment trust — owns income-producing property and distributes most of the rent it collects to unitholders. An **InvIT** does the same for infrastructure assets such as roads, power transmission or telecom towers. Both are listed and traded like shares, and both exist in India under SEBI regulation.',
            'What they solve is genuine: they make commercial real estate accessible without the two things that put it out of reach — the size of the ticket and the illiquidity. You can own a fraction of a portfolio of office parks, and sell it on a Tuesday.',
            'What people get wrong is the **yield**. A distribution yield is not a bond coupon. It is not contractual, it depends on occupancy and rent collection, and it can be cut. A REIT yielding 7% is not a 7% fixed-income instrument — it is an equity-like claim on rental income with an equity-like price that moves.',
            'They also carry **interest rate sensitivity from both directions at once**, which is more than most equities. Higher rates raise the trust\'s own borrowing costs and simultaneously make its yield less attractive against risk-free alternatives. REITs frequently fall when rates rise for exactly this compound reason.',
            'The things worth checking before buying one: **occupancy rate** and its trend, **tenant concentration** — a handful of large tenants is a real risk — **lease expiry schedule**, and **leverage**. Distribution taxation for Indian REITs and InvITs depends on the components of the distribution — interest, dividend, or return of capital — each treated differently, and the rules have been amended. Verify the current treatment rather than assuming the headline yield is your after-tax yield.',
        ],
        inApp: 'Not tradeable in this app. Included because "diversification" often means adding an asset class, and the properties of the asset class need to be understood before that helps.',
        quiz: [
            {
                question: 'A REIT yields 7%. What is that?',
                options: ['A guaranteed 7% return', 'A distribution from rental income — not contractual, dependent on occupancy, and cuttable', 'A bond coupon', 'A dividend guaranteed by SEBI'],
                answer: 1,
                why: 'It is an equity-like claim on rent, not fixed income. Treating a distribution yield as a coupon is the central misunderstanding about REITs.',
            },
            {
                question: 'Why do REITs often fall when interest rates rise?',
                options: ['Property values are fixed', 'Higher rates raise their borrowing costs AND make their yield less attractive against risk-free alternatives', 'Rents fall immediately', 'They do not'],
                answer: 1,
                why: 'The two effects compound, which is why rate sensitivity is larger for REITs than for most equities.',
            },
        ],
    },

    {
        slug: 'mutual-funds-india',
        title: 'Mutual funds in India: categories, costs and SIPs',
        track: 'other-markets',
        level: 'foundation',
        kind: 'study',
        minutes: 8,
        outcome: 'Navigate the category scheme and understand what an SIP does and does not do.',
        where: { href: '/portfolio', label: 'Back to portfolio' },
        visual: {
            kind: 'gauge',
            caption: "The expense ratio is the most reliable predictor of relative future performance \u2014 because the fee is certain and the outperformance is not.",
            value: 0.25,
            a: "direct 0.5%",
            b: "regular 2.0%",
            unit: "% ER",
        },
        prereq: ['etfs-and-index-funds'],
        concept: [
            'SEBI standardised mutual fund categories so that a "large-cap fund" means the same thing at every fund house. Large cap, mid cap, small cap, flexi cap, ELSS, index, debt categories by duration, hybrid. The labels are now comparable across providers, which they were not before.',
            'The **expense ratio** is the annual charge, deducted from NAV daily so you never see a bill. It is the most reliable predictor available of a fund\'s relative future performance — not because expensive managers are worse, but because the fee is certain and the outperformance is not.',
            '**Direct plans** exclude distributor commission and are materially cheaper than regular plans of the identical fund. If you are choosing funds yourself, there is no reason to hold a regular plan, and the difference compounds for as long as you hold.',
            'An **SIP** — systematic investment plan — invests a fixed amount at fixed intervals. It does two useful things: it removes the timing decision, which is where most people damage their own returns, and it makes investing a default rather than a choice repeated monthly.',
            'It is worth being accurate about what an SIP is not. It does not guarantee profit, it does not protect against a falling market, and the "rupee cost averaging" advantage over investing a lump sum you already have is small and depends on the path — lump-sum investing has historically won more often than not, simply because markets rise more often than they fall. **The real value of an SIP is behavioural**, and that is not a lesser reason: it is the reason most people who invest successfully do.',
            'On selection: past returns are the least reliable input and the most heavily marketed one. Category-topping funds rotate. **Cost, mandate consistency and your own ability to hold through a drawdown matter more than last year\'s rank.**',
        ],
        inApp: 'Not held in this app. But the discipline an SIP enforces is the same discipline this simulator tries to teach — decide in advance, execute mechanically, and do not renegotiate mid-drawdown.',
        quiz: [
            {
                question: 'What is the most reliable predictor of a fund\'s relative future performance?',
                options: ['Past returns', 'Its expense ratio — the fee is certain while outperformance is not', 'The manager\'s tenure', 'Fund size'],
                answer: 1,
                why: 'Costs are known in advance and compound with certainty. Past returns are the most marketed input and the least reliable one.',
            },
            {
                question: 'What is the main real benefit of an SIP?',
                options: ['It guarantees better returns than a lump sum', 'Behavioural — it removes the timing decision and makes investing a default', 'It protects against falling markets', 'It reduces taxes'],
                answer: 1,
                why: 'Lump-sum investing has historically won more often, because markets rise more often than they fall. The SIP\'s value is that it gets done — which matters more than the small averaging effect.',
            },
        ],
    },

    {
        slug: 'asset-allocation',
        title: 'Asset allocation: the decision that dominates the others',
        track: 'other-markets',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Set a split you can hold through a drawdown, and rebalance mechanically.',
        where: { href: '/portfolio', label: 'Look at your own mix' },
        visual: {
            kind: 'split-bar',
            caption: "Time horizon, not risk appetite, should set the split. Two years is not long enough to recover a drawdown.",
            steps: [
                { label: "needed in 2 years", note: "cash and short debt", tone: 'up', value: 30 },
                { label: "needed in 10", note: "balanced", tone: 'accent', value: 30 },
                { label: "not needed for 20", note: "equity can afford volatility", tone: 'warn', value: 40 },
            ],
        },
        prereq: ['mutual-funds-india'],
        concept: [
            '**Asset allocation** — how your money is split across equity, debt, gold, cash and anything else — explains far more of a portfolio\'s outcome than the individual choices within each bucket. Picking the right stock inside a 10% allocation cannot outweigh getting the 10% wrong.',
            'The variable that should drive it is **time horizon**, not risk appetite as usually described. Money needed in two years should not be in equity, regardless of how comfortable you feel about volatility, because two years is not long enough to be confident of recovering a drawdown. Money not needed for twenty years can afford equity\'s volatility, because the horizon is long enough for the drift to dominate.',
            'The honest test of any allocation is behavioural: **a portfolio you will abandon in a crash is worse than a more conservative one you will hold.** The historically optimal allocation is worthless if you sell it at the bottom. Sizing to what you can actually tolerate is not a compromise — it is the constraint that makes the plan real.',
            '**Rebalancing** is the mechanical part, and it is where allocation stops being a document. Set target weights; when drift takes them far enough from target, sell what has risen and buy what has fallen back to plan. This forces the behaviour everyone endorses and almost nobody executes, because it always feels wrong — you are selling the thing that is working.',
            'A caution that undermines the standard argument: **correlations rise in crises.** The diversification measured in calm periods is partly absent in the episode you diversified against. This does not make diversification useless — it makes it weaker than the historical correlation matrix suggests, and cash is the one holding that reliably does not correlate with anything.',
            'For a trader specifically, there is a further point. **A trading account should be a defined slice of total assets, decided in advance.** The reason paper trading exists is to establish whether you have an edge before that slice is real money — and to keep the answer honest, this app applies real charges to every fill.',
        ],
        inApp: '[Portfolio](/portfolio) shows exposure by market, which is where drift becomes visible. This simulator is one asset class of your actual life — the allocation decision is the one it cannot make for you.',
        quiz: [
            {
                question: 'What should primarily drive your allocation?',
                options: ['Market outlook', 'Time horizon — when you need the money', 'Recent performance', 'Analyst forecasts'],
                answer: 1,
                why: 'Two years is not long enough to be confident of recovering a drawdown, whatever your risk appetite. Twenty years is long enough for equity drift to dominate.',
            },
            {
                question: 'Why does rebalancing feel wrong when done correctly?',
                options: ['It costs fees', 'You are selling what is working and buying what is not — which is exactly the discipline', 'It is tax inefficient', 'It reduces returns'],
                answer: 1,
                why: 'The discomfort is the mechanism. Rebalancing enforces sell-high buy-low behaviour that almost nobody executes discretionarily.',
            },
            {
                question: 'What weakens the standard diversification argument?',
                options: ['Fees', 'Correlations rise in crises, so measured diversification is partly absent in the episode you diversified against', 'Taxes', 'Nothing'],
                answer: 1,
                why: 'The calm-period correlation matrix overstates the protection. Cash is the one holding that reliably does not correlate with anything.',
            },
        ],
    },
];
