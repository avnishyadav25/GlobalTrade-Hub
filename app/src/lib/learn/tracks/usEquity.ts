import type { Lesson } from '../types';

// Track: US equity.
//
// Written for an Indian investor, because that is who is reading it. The mechanics of
// NYSE and NASDAQ are the easy part; what actually changes outcomes is the currency,
// the LRS route, and the fact that US dividends are withheld at source.

export const US_EQUITY_LESSONS: Lesson[] = [
    {
        slug: 'nyse-nasdaq-sec',
        title: 'NYSE, NASDAQ and the SEC',
        track: 'us-equity',
        level: 'foundation',
        kind: 'study',
        minutes: 7,
        outcome: 'Name the venues and the regulator, and stop believing there is one US stock market.',
        where: { href: '/terminal', label: 'Open a US instrument' },
        concept: [
            'The **NYSE** and **NASDAQ** are the two headline US exchanges — the first historically floor-based with designated market makers, the second electronic from the start. In practice the distinction has almost vanished: both are electronic, and a stock listed on one trades on both.',
            'That last point is the one that surprises people. The US has **dozens of trading venues** — the two big exchanges, a dozen smaller ones, and a large volume of off-exchange trading. A single stock trades simultaneously across all of them.',
            'What holds it together is the **consolidated tape** and a rule requiring your order to be routed to the best available price across venues. So "the price of Apple" is a genuine national best bid and offer, assembled from many books. India has nothing equivalent because it has essentially two exchanges with near-identical prices.',
            'The **SEC** regulates. Its most useful output for an investor is **EDGAR** — a free, public, full-text-searchable archive of every filing every listed US company has ever made. Annual reports, quarterly reports, insider transactions, ownership changes. There is no equivalent depth of free machine-readable filing data for Indian companies.',
            'Settlement is **T+1**, matching India. Trading hours are 9:30am to 4:00pm Eastern, which is roughly 7:00pm to 1:30am IST — a fact that quietly decides whether trading US stocks fits your life at all.',
        ],
        inApp: 'US instruments in this app use simulated price movement, not a live feed. [Research](/research) does pull real fundamentals for US symbols from Finnhub, so the company data is genuine even though the tick is not.',
        quiz: [
            {
                question: 'A stock is listed on NASDAQ. Where does it trade?',
                options: ['Only on NASDAQ', 'Across dozens of venues simultaneously, tied together by a consolidated tape and best-execution routing', 'Only during the opening auction', 'On NYSE only'],
                answer: 1,
                why: 'US equity is fragmented across many venues. The consolidated tape and order-protection rules make it behave like one market, which is why the fragmentation is invisible from outside.',
            },
            {
                question: 'What is EDGAR?',
                options: ['A stock index', 'A trading venue', 'The SEC\'s free public archive of every filing by every listed US company', 'A clearing house'],
                answer: 2,
                why: 'It is the primary source for US company research, free and full-text searchable. No comparable free machine-readable archive exists for Indian filings.',
            },
        ],
        resources: [
            { kind: 'regulator', title: 'SEC EDGAR full-text search', url: 'https://www.sec.gov/edgar/search/', why: 'Search every US filing ever made. Free, no key, no account.' },
        ],
    },

    {
        slug: 'investing-abroad-from-india',
        title: 'Buying US stocks from India',
        track: 'us-equity',
        level: 'foundation',
        kind: 'study',
        minutes: 8,
        outcome: 'Know the route, the limit, and the two taxes that apply before you see a rupee.',
        where: { href: '/funds', label: 'See how currency is handled' },
        prereq: ['nyse-nasdaq-sec'],
        concept: [
            'Indian residents invest abroad through the RBI\'s **Liberalised Remittance Scheme (LRS)**, which permits remittance up to an annual limit per person per financial year. That limit covers everything sent abroad — investment, travel, education, gifts — not investment alone.',
            'Remittances under LRS attract **TCS**, tax collected at source, above a threshold. It is creditable against your income tax, not an extra tax, but it is money withheld now and refunded later.',
            'Then the dividends. The US withholds tax on dividends paid to foreign investors — for Indian residents, under the India-US tax treaty, at a reduced rate against the default. The withholding happens at source: it is gone before the money reaches you. Under the treaty you can claim credit for it against Indian tax on the same income, which requires filing the right form and is the step most people skip.',
            'Capital gains are the reverse. The US generally does **not** tax capital gains for non-resident foreign investors — but India does, and gains on foreign shares are taxed under Indian rules with a longer holding period for long-term treatment than domestic equity enjoys.',
            'You also have a **reporting obligation**. Foreign assets must be disclosed in your Indian tax return in the schedule for foreign assets, regardless of whether you sold anything or made a gain. Non-disclosure carries penalties independent of any tax due, and this is the single most commonly missed obligation among Indian investors holding US stocks.',
            '**Thresholds, rates and the LRS limit change with the budget, so none are quoted here.** The structure — LRS route, TCS on remittance, US withholding on dividends, Indian tax on gains, mandatory foreign-asset disclosure — has been stable. Verify the numbers, and use an accountant if the amounts matter.',
        ],
        inApp: 'This app converts every US position to INR using the live USD/INR rate. It models no tax and no TCS — [Funds](/funds) shows trading charges only.',
        quiz: [
            {
                question: 'What happens to a dividend from a US stock before it reaches an Indian investor?',
                options: ['Nothing', 'It is withheld at source in the US, at a treaty rate — credit is claimable in India but must be filed for', 'It is taxed only in India', 'It is tax free'],
                answer: 1,
                why: 'Withholding is deducted before payment. Treaty credit against Indian tax is available but requires filing the correct form, which is routinely missed.',
            },
            {
                question: 'You hold US stocks and sold nothing this year. What must you still do?',
                options: ['Nothing', 'Disclose the foreign assets in your Indian tax return — non-disclosure carries penalties independent of any tax due', 'File in the US', 'Convert to INR'],
                answer: 1,
                why: 'Foreign-asset disclosure is an obligation to report holdings, not gains. The penalty regime for non-disclosure is separate from and harsher than the tax itself.',
            },
        ],
    },

    {
        slug: 'us-indices',
        title: 'What an index actually measures',
        track: 'us-equity',
        level: 'foundation',
        kind: 'study',
        minutes: 7,
        outcome: 'Explain why the Dow and the S&P disagree, and what "the market was up" leaves out.',
        where: { href: '/terminal', label: 'Compare instruments' },
        prereq: ['nyse-nasdaq-sec'],
        concept: [
            'An index is a rule for combining prices into one number. The rule matters more than most people assume.',
            'The **S&P 500** is weighted by free-float market capitalisation: bigger companies count more, in proportion to their value. The **NASDAQ-100** uses a modified version of the same idea over a narrower, technology-heavy set. The Nifty 50 and Sensex work this way too.',
            'The **Dow Jones Industrial Average** is weighted by **share price** — an accident of its 1896 origins that nobody would design today. A company whose shares trade at $500 moves the Dow ten times as much as one trading at $50, regardless of which is the larger business. This is why the Dow and the S&P can tell different stories on the same day, and why the Dow is quoted far more often than it is used.',
            'The subtler issue with cap weighting is **concentration**. When a handful of very large companies dominate an index, "the market" and "those few companies" become the same measurement. In recent years a small group of US technology firms has accounted for a large share of the S&P 500\'s total value — so an index return can be strongly positive while most of its constituents are flat or down.',
            'Two consequences worth carrying. **A cap-weighted index is not a diversified portfolio** — it is a momentum-weighted one, holding more of whatever has already risen. And **"the market was up 1%" tells you about the weighted average, not about the typical stock.** Breadth — how many constituents rose — is a separate and often contradictory measurement.',
        ],
        inApp: 'This app trades individual instruments, not indices. Comparing several on [Terminal](/terminal) is the manual version of what an index does automatically.',
        quiz: [
            {
                question: 'Why can the Dow and the S&P 500 disagree on the same day?',
                options: ['They cover different countries', 'The Dow weights by share price, the S&P by market capitalisation', 'The Dow is calculated weekly', 'The S&P excludes technology'],
                answer: 1,
                why: 'Price weighting is a 19th-century accident: a $500 stock moves the Dow ten times as much as a $50 one regardless of company size. Nobody would design it that way today.',
            },
            {
                question: 'A cap-weighted index rose 1%. What does that NOT tell you?',
                options: ['The weighted average return', 'Whether most constituents actually rose — breadth is a separate measurement', 'The index level', 'The largest holding'],
                answer: 1,
                why: 'When a few very large companies dominate, the index can rise while most of its members fall. Breadth and index return regularly diverge, and only one of them gets reported.',
            },
        ],
    },

    {
        slug: 'us-market-structure',
        title: 'Pre-market, after-hours, and who is on the other side',
        track: 'us-equity',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Understand why an extended-hours price is unreliable and what payment for order flow means for you.',
        where: { href: '/orders', label: 'Review your fills' },
        prereq: ['us-indices'],
        concept: [
            'US stocks trade outside the 9:30–4:00 session in **pre-market** and **after-hours** sessions. Most earnings are released into those windows deliberately, so the headline "stock jumped 8% after results" almost always describes an extended-hours print.',
            'Those prints are unreliable in a specific way. Volume is a small fraction of regular hours, spreads are wide, and many order types are unavailable. A stock can show +8% after-hours on a few thousand shares and open the next morning at +2%. **The extended-hours price is a thin quote, not a consensus** — and for an Indian investor, whose evening coincides with the US morning, that distinction decides how much weight to put on what you are seeing at 2am IST.',
            '**Payment for order flow** is the other structural feature worth understanding. Many US retail brokers do not send your order to an exchange. They sell it to a wholesale market maker, who executes it internally and pays the broker for the privilege. This is what funds zero-commission trading.',
            'Is it bad for you? Genuinely contested, and worth stating honestly. Wholesalers typically execute retail orders slightly *inside* the public spread, so the measurable execution is often marginally better than the exchange quote. The counter-argument is that retail flow is valuable precisely because it is uninformed, that the price improvement is smaller than the value extracted, and that the arrangement makes the broker\'s incentives point away from yours.',
            'What follows practically: **zero commission is not zero cost.** The cost moved from a visible line item to an invisible one in the spread. That is worth knowing regardless of which side of the debate you find convincing.',
        ],
        inApp: 'This simulator fills at the quoted price during a continuous simulated session. It models neither extended hours nor internalisation — which makes fills here cleaner than real ones.',
        quiz: [
            {
                question: 'A stock is up 8% after-hours on earnings. How much should you trust that number?',
                options: ['Completely', 'Little — extended-hours volume is thin and spreads are wide, so the open often differs materially', 'It is the official close', 'Only if it is on NASDAQ'],
                answer: 1,
                why: 'A thin quote on a few thousand shares is not consensus. This matters especially for Indian investors watching US earnings in the middle of the night.',
            },
            {
                question: 'What does "zero commission" actually mean at a US retail broker?',
                options: ['Trading is free', 'The visible fee is gone; the cost usually moved into the spread via payment for order flow', 'The exchange pays the broker', 'It applies only to large orders'],
                answer: 1,
                why: 'The broker sells your order to a wholesaler rather than routing it to an exchange. Whether that is net good for you is genuinely contested — but it is not free.',
            },
        ],
    },

    {
        slug: 'earnings-season',
        title: 'Earnings season and the expectations game',
        track: 'us-equity',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Explain why a company can beat estimates and fall, and where to find the real filing.',
        where: { href: '/research', label: 'See the earnings calendar' },
        prereq: ['us-market-structure'],
        concept: [
            'US companies report quarterly, and the reports cluster into four **earnings seasons** a year. Each company files a **10-Q** for a quarter and a **10-K** for the year — the real documents, filed with the SEC, distinct from the press release and the slide deck that get reported.',
            'The single most important thing to understand about earnings is that **price responds to the surprise, not the result.** Analysts publish estimates; the market prices in the consensus in advance. A company that grows earnings 30% and was expected to grow 35% will usually fall. The number that moves the stock is actual minus expected.',
            'And often not even that. **Guidance** — what management says about the next quarter — frequently matters more than the quarter just reported, because the reported quarter is history and the guidance is the new estimate everything will be measured against.',
            'This produces the well-documented pattern of a company "beating on both lines" and dropping 10%, which looks irrational until you know what was already priced.',
            'There is a genuine, extensively studied effect here: **post-earnings-announcement drift** — the tendency of stocks that surprise strongly to continue drifting in the surprise\'s direction for weeks. It is one of the most robust anomalies in the academic literature and it survives, in weakened form, decades after publication.',
            'Practically: read the 10-Q rather than the press release. The release is written to be flattering; the filing is written to be legally accurate, and the differences between them are informative.',
        ],
        inApp: '[Research](/research) serves the real Finnhub earnings calendar with actual-versus-estimate EPS. That same surprise figure drives the **PEAD strategy** in the [strategy library](/strategies) — the lesson and the strategy read the same data.',
        quiz: [
            {
                question: 'A company grows earnings 30%, against an expected 35%, and the stock falls. Why?',
                options: ['The market is irrational', 'Price responds to the surprise, not the result — the 35% was already priced in', 'Growth is bad', 'Earnings were restated'],
                answer: 1,
                why: 'Consensus is priced in advance. Actual minus expected is what moves the stock, which is why "beat and fall" is common rather than paradoxical.',
            },
            {
                question: 'What is post-earnings-announcement drift?',
                options: ['A trading halt after results', 'The tendency of strongly surprising stocks to keep drifting in the surprise direction for weeks', 'The after-hours price gap', 'Analyst revisions'],
                answer: 1,
                why: 'One of the most robust documented anomalies — it has persisted in weakened form for decades since publication. It is the basis of the PEAD strategy in this app.',
            },
        ],
        resources: [
            { kind: 'regulator', title: 'SEC EDGAR full-text search', url: 'https://www.sec.gov/edgar/search/', why: 'Read the 10-Q itself rather than the press release about it.' },
        ],
    },

    {
        slug: 'currency-risk',
        title: 'Your dollar return is not your rupee return',
        track: 'us-equity',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Decompose a foreign return into asset and currency components, and stop double-counting.',
        where: { href: '/portfolio', label: 'See your INR-converted book' },
        prereq: ['investing-abroad-from-india'],
        visual: 'fx-conversion',
        concept: [
            'When an Indian investor buys a US stock, two bets are made and only one is chosen deliberately. The first is on the company. The second is on the **rupee against the dollar**.',
            'They combine multiplicatively, not additively. A stock up 10% in dollars while the rupee weakens 4% against the dollar returns roughly 14.4% in rupees — `1.10 × 1.04`, not `1.10 + 0.04`. Over long periods and large moves the difference between the two calculations is substantial.',
            'The rupee has depreciated against the dollar over most long horizons, which has historically been a **tailwind** for Indian holders of US assets. That is a real historical fact and not a guarantee. A currency that has trended for decades can stop; treating past depreciation as a reliable additional return is exactly the assumption that fails when it matters.',
            'The important consequence is a **diversification** one, and it points the other way from what people expect. US assets are usually held to diversify away from India. But if the rupee weakens when Indian markets fall — which is the common pattern, since the two often share a cause in capital outflows — then the currency exposure *helps* precisely when you need it. Foreign assets diversify Indian risk partly through the currency, not despite it.',
            'The mirror image is a genuine hazard: **judging a foreign investment by its rupee return alone conflates two decisions.** A US position that lost 5% in dollars but shows a rupee gain because the currency moved is still a position that lost money on the thesis you actually had. Track both, and know which one you were right about.',
        ],
        inApp: 'Everything in this app is converted to INR through the live USD/INR rate, so your paper P&L already contains both effects. `deriveFxRates()` prices the whole rupee book from that one rate — which is why it is the most load-bearing number in the app.',
        formulas: [
            {
                label: 'Return in your base currency',
                expr: 'r_INR = (1 + r_asset) × (1 + r_currency) − 1',
                terms: [
                    { sym: 'r_asset', meaning: 'the return in the asset\'s own currency' },
                    { sym: 'r_currency', meaning: 'appreciation of the quote currency against the rupee' },
                ],
                worked: () => 'A stock +10% in USD with the rupee 4% weaker: 1.10 × 1.04 − 1 = 14.4%, not 14%.',
            },
        ],
        quiz: [
            {
                question: 'A US stock rose 10% in dollars; the rupee weakened 4%. What is the rupee return?',
                options: ['6%', '14%', 'About 14.4% — the effects multiply', '10%'],
                answer: 2,
                why: '1.10 × 1.04 − 1 = 14.4%. The effects compound rather than add, and the gap grows with the size of the moves.',
            },
            {
                question: 'Your US position lost 5% in dollars but shows a rupee gain. What did you get right?',
                options: ['The stock', 'The currency, not the thesis — those are separate decisions and worth tracking separately', 'Both', 'Neither'],
                answer: 1,
                why: 'A rupee gain masking a dollar loss means the currency rescued a wrong call. Conflating the two makes it impossible to learn whether your stock selection works.',
            },
        ],
    },
];
