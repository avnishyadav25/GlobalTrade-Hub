import type { Lesson } from '../types';

// Track: commodities.
//
// The futures-curve lesson is the load-bearing one: almost everything that surprises
// people about commodity investing — why an oil ETF can fall while oil rises — comes
// from the curve rather than from the spot price.

export const COMMODITY_LESSONS: Lesson[] = [
    {
        slug: 'commodity-basics',
        title: 'Commodities: the price of a physical thing',
        track: 'commodities',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Explain why commodity prices behave differently from equity prices.',
        where: { href: '/terminal', label: 'Open a commodity' },
        concept: [
            'A commodity is a standardised physical good — crude oil, gold, copper, wheat — where one unit is interchangeable with another of the same grade. That standardisation is what makes a futures market possible.',
            'They differ from equities in a way that changes everything about how they behave. **A share is a claim on future profits; a barrel of oil is a barrel of oil.** It produces no cash flow, pays no dividend, and cannot compound. Its price is set by supply and demand for the physical good, not by discounting anything.',
            'That gives commodities their characteristic dynamics. **Supply is inelastic in the short run** — a mine or an oil field cannot increase output this month — so a demand shock has nowhere to go except into price. This is why commodity moves are violent relative to equity moves, and why they mean-revert over long horizons as supply eventually responds.',
            '**Storage costs money**, and this is the second structural fact. Holding physical oil requires tanks, insurance and financing; holding gold requires a vault. That cost has to be paid by someone, and it shows up in the relationship between spot and futures prices — the subject of the next lesson.',
            'Almost nobody trades the physical good. Exposure comes through **futures**, which introduces a set of mechanics — expiry, rolling, curve shape — that have nothing to do with your view on the commodity and can easily dominate your return.',
        ],
        inApp: 'Commodity prices here come from Twelve Data via `/api/marketdata`. **The free tier is 8 requests a minute**, so everything goes through `cachedFetch` — which is why prices update less often than crypto.',
        quiz: [
            {
                question: 'Why do commodity prices move more violently than equity prices?',
                options: ['More speculators', 'Short-run supply is inelastic, so a demand shock has nowhere to go but into price', 'Lower liquidity', 'They trade fewer hours'],
                answer: 1,
                why: 'A mine or oil field cannot raise output this month. The adjustment happens entirely in price until supply can respond, which takes years.',
            },
            {
                question: 'What does a commodity not have that a share does?',
                options: ['A price', 'A cash flow to discount — it produces nothing and cannot compound', 'Volatility', 'A market'],
                answer: 1,
                why: 'A share is a claim on future profits. A barrel of oil is a barrel of oil, which is why commodity valuation cannot use discounting at all.',
            },
        ],
    },

    {
        slug: 'futures-curve',
        title: 'Contango and backwardation: why the curve costs you money',
        track: 'commodities',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Explain how an oil fund can lose money in a year when oil rose.',
        where: { href: '/backtest', label: 'Back to testing' },
        prereq: ['commodity-basics'],
        visual: 'futures-curve',
        concept: [
            'Futures exist for many delivery months at once, and plotting their prices gives the **futures curve**. Its shape is one of the most consequential and least understood facts in commodity investing.',
            '**Contango** is an upward-sloping curve: later delivery costs more than earlier. This is the normal state for storable commodities, because the later contract must cover storage, insurance and financing until delivery.',
            '**Backwardation** is the opposite — later delivery is cheaper. It signals a shortage now: buyers are paying a premium for immediate physical delivery, which is called a convenience yield.',
            'Here is why it matters to anyone who is not taking delivery. **A long futures position must be rolled** before expiry: sell the expiring contract, buy the next one. **In contango you sell low and buy high on every single roll.** That is a recurring, structural cost, paid regardless of what the price does.',
            'This produces the outcome that catches investors every cycle: **an oil ETF can fall over a year in which the spot price of oil rose.** The fund is not tracking oil — it is tracking a rolled futures position, and in steep contango the roll cost exceeded the price gain. It is not a tracking error or a bad fund. It is what the instrument does, and it is documented in the fund\'s own prospectus.',
            'The rule to carry: **with commodities, the curve can matter more than the price.** Before buying any commodity fund, find out whether it holds futures and how it rolls them, because that is often the larger determinant of your return.',
        ],
        inApp: 'This app trades commodity **spot** prices with no expiry, roll or curve — so none of this cost is modelled here. The plan notes that calendar spreads and roll rules are unbuildable without a futures curve and contract model, and they are listed as not built rather than approximated.',
        formulas: [
            {
                label: 'Roll yield',
                expr: 'roll yield = (near price − far price) ÷ near price',
                terms: [{ sym: 'sign', meaning: 'negative in contango (a cost), positive in backwardation (a gain)' }],
                worked: () => 'Near at 80, far at 84: each roll gives up 5%. Rolled monthly, that is a very large annual drag before the price does anything.',
            },
        ],
        quiz: [
            {
                question: 'Oil rose 10% over a year and an oil ETF fell. What happened?',
                options: ['Fund mismanagement', 'Contango — each roll sold the cheap expiring contract and bought a more expensive one, and the roll cost exceeded the gain', 'Currency movement', 'High fees'],
                answer: 1,
                why: 'The fund tracks a rolled futures position, not spot. In steep contango the roll cost is structural and disclosed in the prospectus — not an error.',
            },
            {
                question: 'What does backwardation signal?',
                options: ['Oversupply', 'A shortage now — buyers paying a premium for immediate physical delivery', 'High storage costs', 'Low interest rates'],
                answer: 1,
                why: 'Later delivery being cheaper means immediacy is worth paying for. That convenience yield is a real signal about physical tightness.',
            },
        ],
    },

    {
        slug: 'gold-in-india',
        title: 'Gold: five ways to own it, and what each costs',
        track: 'commodities',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Compare the ownership routes on cost, tax and counterparty risk.',
        where: { href: '/terminal', label: 'Look at a gold price' },
        prereq: ['commodity-basics'],
        concept: [
            'India is among the largest consumers of gold in the world, and gold occupies a place in Indian household portfolios that has no equivalent in most markets. It is worth being precise about the alternatives, because they differ far more than the underlying metal suggests.',
            '**Jewellery** carries making charges — often a substantial percentage — that are not recovered on sale, plus a purity discount when selling back. As an investment it starts well behind. Its value is that it is also jewellery.',
            '**Physical bars and coins** avoid making charges but carry a buy-sell spread, storage cost and theft risk. Selling requires finding a buyer who will pay a fair assay.',
            '**Gold ETFs** track the price, trade on the exchange in your demat account, and charge a small annual expense ratio. Liquid, no storage, no purity question. **Sovereign Gold Bonds** are government-issued, pay a fixed interest rate on top of the gold price, and have historically carried favourable treatment if held to maturity — but they have a long tenure and limited secondary liquidity. Availability of new issues has varied, so check current status rather than assuming.',
            'Two things worth understanding about gold itself. **Its long-run real return is close to zero** — over very long horizons it has roughly preserved purchasing power rather than grown it, which is a different proposition from equity. And **for an Indian buyer, gold is a dollar asset in disguise**: it is priced in dollars globally, so the rupee price includes the USD/INR rate. Part of gold\'s appeal to Indian households has historically been rupee depreciation rather than gold appreciation, and separating the two is worth doing before deciding how much to hold.',
        ],
        inApp: 'Gold prices in the app come from Twelve Data and are converted to INR through the live USD/INR rate — which means you can see both components this lesson describes.',
        quiz: [
            {
                question: 'For an Indian buyer, what is embedded in the rupee gold price?',
                options: ['Only the gold price', 'The USD/INR rate — gold is priced in dollars globally, so part of the return is currency', 'Import duty only', 'Making charges'],
                answer: 1,
                why: 'Rupee gold combines the dollar gold price and the exchange rate. Much of gold\'s historical appeal to Indian households was rupee depreciation, which is a separate bet worth naming.',
            },
            {
                question: 'What is gold\'s approximate long-run real return?',
                options: ['Similar to equities', 'Close to zero — it has roughly preserved purchasing power rather than grown it', 'Negative', 'Higher than equities'],
                answer: 1,
                why: 'Preserving purchasing power is a genuinely useful property, and it is a different proposition from compounding. Sizing a holding depends on knowing which one you are buying.',
            },
        ],
    },

    {
        slug: 'crude-and-spreads',
        title: 'Crude oil and the crack spread',
        track: 'commodities',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Explain what a refiner actually trades, and why a spread can be safer than either leg.',
        where: { href: '/strategies', label: 'See the crack spread strategy' },
        prereq: ['futures-curve'],
        concept: [
            'Crude oil is not one price. **WTI** and **Brent** are different benchmarks with different delivery points and quality, and the spread between them reflects transport and regional supply rather than a disagreement about oil.',
            'Crude is also not directly consumable. It is refined into products — gasoline, diesel, jet fuel — and a refinery\'s economics depend not on the price of oil but on the **difference** between what it pays for crude and what it receives for products. That difference is the **crack spread**, and it is what a refiner actually manages.',
            'The spread can widen while crude falls, or narrow while crude rises. A refiner hedging its margin cares about the relationship, not the level — which is the general insight worth taking from this lesson: **many real commodity participants are trading spreads, not prices.**',
            'A spread position is long one thing and short a related one, so the shared component cancels. That usually means far lower volatility than either leg alone, and a bet on a specific economic relationship rather than on a broad direction. It is also why spread positions can look deceptively safe — the volatility is low **until the relationship breaks**, and relationships break under exactly the conditions that caused you to want the trade.',
            'The other crude driver worth knowing is **inventories**. Weekly US inventory data moves the price sharply and predictably in timing if not direction, because it is the clearest regular read on whether supply is exceeding demand.',
        ],
        inApp: 'The **crack spread** strategy in the [library](/strategies) trades `CL=F` against `RB=F` — both verified available with about 580 days of daily history. The **EIA inventory** strategy needs a free `EIA_API_KEY`, and is hidden with a "needs a key" note when unset rather than being faked.',
        quiz: [
            {
                question: 'What does a refiner actually care about?',
                options: ['The price of crude', 'The spread between crude and refined products — its processing margin', 'The Brent-WTI spread', 'Inventory levels'],
                answer: 1,
                why: 'The crack spread is the refiner\'s margin. It can widen while crude falls, which is why hedging the level rather than the relationship would miss the actual risk.',
            },
            {
                question: 'Why can a spread position be deceptively safe?',
                options: ['It has no margin', 'Low volatility while the relationship holds — and relationships break under exactly the conditions that made the trade attractive', 'It cannot lose', 'Fees are lower'],
                answer: 1,
                why: 'The shared component cancels, suppressing volatility until it does not. The measured risk understates the real risk precisely when it matters.',
            },
        ],
    },

    {
        slug: 'mcx-and-indian-commodities',
        title: 'Trading commodities in India',
        track: 'commodities',
        level: 'intermediate',
        kind: 'study',
        minutes: 7,
        outcome: 'Know the venue, the contract mechanics and the currency exposure you inherit.',
        where: { href: '/settings', label: 'Broker connections' },
        prereq: ['commodity-basics'],
        concept: [
            '**MCX** is India\'s principal commodity derivatives exchange, regulated by SEBI since commodity regulation was merged into it. It lists futures and options on gold, silver, crude oil, natural gas and base metals; **NCDEX** covers agricultural commodities.',
            'Three mechanical points decide whether a contract is usable by an individual. **Lot sizes** are set by the exchange and can represent large notional values — which is why "mini" and "micro" contracts exist for gold and silver. **Trading hours** for internationally-linked commodities extend into the evening to overlap with global markets. And **settlement** varies by contract: some are cash-settled, others compulsorily deliverable, and taking delivery of a lot of crude oil is not a theoretical concern for someone who did not read the contract specification.',
            'The currency point is easy to miss and affects every position. **Internationally-referenced Indian commodity contracts are priced in rupees but track a dollar benchmark.** Your rupee P&L therefore contains a USD/INR component you did not choose. Gold can be flat in dollars and up in rupees purely on the exchange rate.',
            'Taxation follows the F&O treatment: commodity derivatives income is generally **non-speculative business income**, taxed at slab rates with the audit and set-off rules that go with it — a different regime from equity capital gains. **CTT**, commodities transaction tax, applies to certain contracts. Verify current rates and applicability rather than assuming.',
            'The practical caution is the same as for all derivatives: leverage plus a lot size larger than you intended is how a small commodity position becomes an outsized one.',
        ],
        inApp: 'This app has **no MCX connection and no commodity futures** — commodity instruments here are simulated spot prices. [Settings](/settings) has no commodity broker connector.',
        quiz: [
            {
                question: 'An Indian gold futures contract is priced in rupees. What else are you exposed to?',
                options: ['Nothing', 'USD/INR — the contract tracks a dollar benchmark, so the exchange rate is inside your P&L', 'Only import duty', 'Interest rates'],
                answer: 1,
                why: 'Internationally-referenced contracts track dollar benchmarks. Gold can be flat in dollars and up in rupees purely on the exchange rate.',
            },
            {
                question: 'How is Indian commodity derivatives income generally taxed?',
                options: ['Capital gains', 'Non-speculative business income, at slab rates', 'Tax free', 'Speculative income'],
                answer: 1,
                why: 'It follows the F&O treatment rather than equity capital gains, which brings different set-off and audit rules. Verify current specifics — the framework is amended periodically.',
            },
        ],
    },

    {
        slug: 'commodities-in-a-portfolio',
        title: 'The inflation hedge claim, examined',
        track: 'commodities',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Decide how much commodity exposure is defensible, and on what evidence.',
        where: { href: '/portfolio', label: 'Look at your allocation' },
        prereq: ['futures-curve'],
        concept: [
            'Commodities are usually sold to investors on two claims: they hedge inflation, and they diversify equities. Both are partly true, and the qualifications are where the money is.',
            '**On inflation.** Commodities do respond to inflation, because commodity prices are a *component* of inflation rather than merely a reaction to it. When energy prices drive an inflation print, energy exposure works. But the relationship is far weaker for inflation driven by services, wages or housing, and the volatility required to obtain the hedge is very large relative to the inflation being hedged.',
            '**On diversification.** The correlation with equities is genuinely low on average, and it is unreliable exactly when it matters. In a broad liquidation everything correlated with risk appetite falls together, and commodities have participated in those episodes.',
            'Against both claims sits the structural cost from the curve lesson: **a long commodity index position in contango pays a continuous roll cost.** Over long horizons that drag has consumed a substantial part of the return from broad commodity index investing — which is why the long-run record of passive commodity exposure is considerably worse than the spot price charts imply.',
            'A defensible position, stated as a position rather than as advice: **a small allocation, sized as insurance rather than as a growth asset, and chosen with the curve in mind.** For an Indian investor, gold already provides part of what commodities are supposed to offer, and it does so without a roll cost. Anyone recommending a large commodity allocation on the inflation argument should be able to say which inflation and what the roll costs.',
        ],
        inApp: '[Portfolio](/portfolio) shows your exposure by market, which is where an allocation decision becomes visible. The app cannot model roll cost — it has no futures curve — so its commodity returns are optimistic relative to a real fund.',
        quiz: [
            {
                question: 'What is the main structural drag on passive long commodity index exposure?',
                options: ['Management fees', 'The roll cost in contango, paid continuously regardless of price direction', 'Currency', 'Storage'],
                answer: 1,
                why: 'The roll is paid every cycle whatever the price does. It is why the long-run record of broad commodity index investing is much worse than spot charts suggest.',
            },
            {
                question: 'When is the commodities-as-inflation-hedge argument weakest?',
                options: ['During energy shocks', 'When inflation is driven by services, wages or housing rather than commodity prices', 'During recessions', 'It is never weak'],
                answer: 1,
                why: 'Commodities are a component of inflation, so they hedge the commodity-driven part well and the rest poorly — and the volatility cost of the hedge is high either way.',
            },
        ],
    },
];
