import type { Lesson } from '../types';

// Track: forex.
//
// The legality lesson is the important one for an Indian reader and it is placed
// early rather than buried: offshore leveraged retail forex is not a grey area under
// FEMA, and the app trades FX pairs as a simulation only.

export const FOREX_LESSONS: Lesson[] = [
    {
        slug: 'currency-pairs',
        title: 'Reading a currency pair',
        track: 'forex',
        level: 'intermediate',
        kind: 'study',
        minutes: 7,
        outcome: 'Say what a quoted FX price means and which currency you are actually long.',
        where: { href: '/terminal', label: 'Open a currency pair' },
        concept: [
            'A currency has no price on its own — only a price against another currency. So FX quotes come in **pairs**: `EUR/USD`, `USD/JPY`, `USD/INR`.',
            'The first currency is the **base**, the second the **quote**. The number is how much of the quote currency buys one unit of the base. `USD/INR = 88` means one dollar costs 88 rupees.',
            'Buying a pair means **long the base, short the quote** — simultaneously. There is no way to be long a currency in isolation; every FX position is a relative bet, which is why "the dollar is strong" is only meaningful with an "against what".',
            'A **pip** is the conventional smallest increment — the fourth decimal for most pairs, the second for JPY pairs because a yen is worth so much less per unit. Position size is quoted in **lots**, and a standard lot of 100,000 units is why small percentage moves produce large P&L numbers.',
            'The trap that catches people converting to their own currency: **the quote currency decides what a pip is worth.** In `USD/JPY` the pip value is in yen, not dollars, and must be converted. Assuming every pair settles in USD is the most common sizing error in FX, and it produces positions that are quietly several times larger than intended.',
        ],
        inApp: 'FX prices here come from Twelve Data through `/api/marketdata`, and every pair is converted to INR with the shared `toBase()` helper. `USD/JPY` is JPY-quoted — the app does not assume USD, and neither should you.',
        quiz: [
            {
                question: 'You buy EUR/USD. What position do you hold?',
                options: ['Long euro only', 'Long euro and short dollar simultaneously', 'Short euro', 'Long both'],
                answer: 1,
                why: 'Every FX position is relative. There is no way to be long a currency without being short another, which is why "the dollar is strong" needs an "against what".',
            },
            {
                question: 'What is a pip in USD/JPY worth?',
                options: ['Always one dollar', 'An amount in yen, which must be converted', 'It varies by broker', 'Nothing until you close'],
                answer: 1,
                why: 'The quote currency determines pip value. Assuming USD settlement on a JPY-quoted pair produces positions several times the intended size.',
            },
        ],
    },

    {
        slug: 'fx-in-india',
        title: 'What an Indian resident may legally trade',
        track: 'forex',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Know which FX products are permitted in India and why the advertised ones usually are not.',
        where: { href: '/settings', label: 'Broker connections' },
        prereq: ['currency-pairs'],
        concept: [
            'This lesson exists because the advertising is relentless and the rules are not widely known. It is worth being precise.',
            'Indian residents may trade **currency derivatives on Indian recognised exchanges** — NSE, BSE and MSE — in a defined set of contracts. That means INR pairs such as `USD/INR`, `EUR/INR`, `GBP/INR` and `JPY/INR`, plus certain cross-currency pairs, in exchange-listed futures and options through a SEBI-registered broker.',
            '**What is not permitted is leveraged margin trading in foreign currency pairs through offshore online platforms.** Under FEMA, remittance for margin FX speculation is not a permitted current-account transaction. The RBI has repeatedly issued public advisories about unauthorised electronic trading platforms and has published an alert list of entities not authorised to deal in forex. The legal exposure sits with the resident who remits, not only with the platform.',
            'The practical position, stated plainly: **the leveraged 500× "forex broker" advertised to Indian users is not a regulated route for an Indian resident**, and the risk is not confined to the trading. Money sent to an unauthorised offshore platform has no domestic recourse if the platform refuses withdrawal — a common enough outcome to be its own category of complaint.',
            'This is not tax or legal advice, and the framework is amended periodically. Check the RBI\'s current advisories and alert list before assuming any platform is usable, and prefer exchange-traded currency derivatives if you want this exposure at all.',
        ],
        inApp: 'The FX pairs in this app are a **simulation** for learning, not a brokerage route — there is no FX broker integration and none is planned. [Settings](/settings) has no FX connector.',
        quiz: [
            {
                question: 'Which FX route is available to an Indian resident?',
                options: ['Any offshore platform with high leverage', 'Currency derivatives on recognised Indian exchanges through a SEBI-registered broker', 'Only physical currency exchange', 'None'],
                answer: 1,
                why: 'Exchange-traded currency derivatives are the permitted route. Remitting margin to offshore leveraged FX platforms is not a permitted transaction under FEMA.',
            },
            {
                question: 'What is the risk beyond trading losses on an unauthorised offshore platform?',
                options: ['Higher spreads', 'No domestic recourse if withdrawal is refused — and the FEMA exposure sits with the resident who remitted', 'Slower execution', 'Currency conversion fees'],
                answer: 1,
                why: 'The RBI publishes an alert list precisely because this recurs. Money sent outside the permitted route has no domestic remedy when the platform stops paying.',
            },
        ],
        resources: [
            { kind: 'regulator', title: 'Reserve Bank of India', url: 'https://www.rbi.org.in/', why: 'Current FEMA position and the alert list of entities not authorised to deal in forex.' },
        ],
    },

    {
        slug: 'what-moves-currencies',
        title: 'What actually moves a currency',
        track: 'forex',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Rank the drivers by horizon, and stop expecting economics to explain a daily move.',
        where: { href: '/terminal', label: 'Watch USD/INR' },
        prereq: ['currency-pairs'],
        concept: [
            'Currencies respond to different things over different horizons, and most confusion comes from applying a long-horizon explanation to a short-horizon move.',
            '**Over days: interest rate expectations.** Not the current rate — the *expected change*. A central bank holding rates while the market expected a cut will strengthen its currency, because capital flows to where the expected return is higher and the flow reprices instantly.',
            '**Over months: capital flows and risk sentiment.** Money moving into or out of a country\'s assets must be converted, and that conversion is the trade. In risk-off periods capital moves toward the dollar, yen and Swiss franc regardless of those economies\' merits, which is why "safe haven" flows can overwhelm domestic fundamentals entirely.',
            '**Over years: inflation differentials and the trade balance.** A country with persistently higher inflation sees its currency depreciate — this is the mechanism behind the rupee\'s long slide against the dollar, and it is arithmetic rather than sentiment. Persistent trade deficits work the same way, requiring continual funding.',
            'And **central bank intervention** cuts across all of it. The RBI actively manages rupee volatility using its reserves, which means `USD/INR` is a **managed** rate rather than a freely floating one. It moves less than pure market forces would produce, until the managing stops — which makes its historical volatility an unreliable guide to its future volatility.',
            'The honest summary: over short horizons, FX is dominated by positioning and flow, and economic narratives are usually attached to moves after the fact.',
        ],
        inApp: '`USD/INR` is the most load-bearing number in this app — `deriveFxRates()` prices the entire rupee book from it. It comes live from Yahoo with frankfurter.app as backup.',
        quiz: [
            {
                question: 'A central bank holds rates when a cut was expected. What happens to its currency?',
                options: ['It weakens', 'It strengthens — the expected change was priced, not the level', 'No effect', 'It depends on inflation'],
                answer: 1,
                why: 'Markets price expectations. The surprise is the change relative to what was expected, not the absolute level of the rate.',
            },
            {
                question: 'Why is USD/INR volatility an unreliable guide to future volatility?',
                options: ['The data is poor', 'The RBI actively manages it, so it moves less than market forces alone would produce — until the managing stops', 'It is quoted inversely', 'It only trades in India'],
                answer: 1,
                why: 'A managed rate suppresses volatility until intervention capacity or willingness changes. Historical calm in a managed currency is not evidence of future calm.',
            },
        ],
    },

    {
        slug: 'fx-leverage',
        title: 'Leverage: why retail FX accounts die',
        track: 'forex',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Compute how far price can move before a leveraged FX position is closed out.',
        where: { href: '/funds', label: 'See your buying power' },
        prereq: ['fx-in-india'],
        visual: 'risk-sizing',
        concept: [
            'Currency pairs move very little. A major pair might move 0.5% in a day — far less than a typical stock. Leverage is what makes that tradeable, and it is also what makes retail FX so consistently destructive.',
            'The arithmetic is unforgiving and worth doing once. **At 50× leverage, a 2% adverse move wipes out your entire margin. At 100×, 1%. At 500×, 0.2%** — which for many pairs is an ordinary hour.',
            'Retail platforms advertise leverage as a feature, and it is a feature for them: their revenue scales with turnover, and higher leverage produces more turnover per unit of client capital. Published disclosures from regulated brokers in jurisdictions that require them have consistently shown **the large majority of retail accounts losing money** — often quoted in the 70–80% range. Those figures come from the brokers themselves.',
            'What compounds it is that FX offers no natural drift to fall back on. Equity has a long-run upward tendency, so a badly-timed but unleveraged stock position often recovers with patience. **A currency pair has no such tendency** — it is a relative price, and there is no reason it should rise over time. Leverage removes the patience, and the asset removes the recovery.',
            'The one genuinely defensible retail use is **hedging a real exposure**: an exporter, a freelancer paid in dollars, a parent funding overseas education. There the currency risk already exists and is being reduced rather than created, and that is a completely different activity from speculating on it.',
        ],
        inApp: 'This simulator applies no leverage to FX — positions are sized against real buying power, and [Funds](/funds) shows it. That makes paper FX here considerably safer than the advertised article.',
        formulas: [
            {
                label: 'Distance to wipeout',
                expr: 'adverse move that exhausts margin ≈ 1 ÷ leverage',
                terms: [{ sym: 'leverage', meaning: 'notional exposure divided by margin posted' }],
                worked: () => 'At 50× a 2% move is fatal; at 100×, 1%; at 500×, 0.2% — for many pairs, an ordinary hour.',
            },
        ],
        quiz: [
            {
                question: 'At 100× leverage, how far can a pair move against you before your margin is gone?',
                options: ['10%', '1%', '25%', 'There is no limit'],
                answer: 1,
                why: 'Roughly 1%, before spread and financing. Major pairs move that much routinely, which is the whole explanation for the retail loss statistics.',
            },
            {
                question: 'Why does a bad FX position recover less often than a bad stock position?',
                options: ['FX is more volatile', 'A currency pair is a relative price with no long-run upward tendency to rely on', 'FX has higher fees', 'It does recover more often'],
                answer: 1,
                why: 'Equity has a long-run drift that rewards patience. A pair has none — and leverage removes the patience anyway.',
            },
        ],
    },

    {
        slug: 'carry-trade',
        title: 'The carry trade, and how it ends',
        track: 'forex',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Explain why borrowing cheap to hold high-yield works for years and then unwinds in days.',
        where: { href: '/strategies', label: 'See the funding-carry signal' },
        prereq: ['what-moves-currencies'],
        concept: [
            'The **carry trade** borrows in a low-interest currency and holds a high-interest one, collecting the difference. Historically this has been one of the most persistently profitable FX strategies, which by itself should prompt suspicion.',
            'Theory says it should not work. **Uncovered interest parity** holds that the high-yield currency should depreciate by exactly the interest differential, leaving no profit. Empirically it has not — high-yield currencies have often *appreciated* as capital chased the yield, giving carry traders both the interest and a capital gain.',
            'The explanation is that carry is compensation for a risk that does not show up in ordinary volatility. **Carry returns are steady, positive, low-variance — and then catastrophic.** Capital flows in gradually and exits all at once, so the unwind is faster and more violent than the accumulation. Years of accumulated gains can reverse in days.',
            'This is why the strategy is described as "picking up pennies in front of a steamroller", and why it looks superb on any risk measure that assumes normally distributed returns. A Sharpe ratio computed over a calm period is exactly the wrong tool for it: **the risk is in the tail, and the tail is absent from the sample most of the time.**',
            'The same structure appears in crypto as **funding-rate carry** — long spot, short the perpetual, collecting funding. Same shape, same failure mode: steady accrual, then a violent move that liquidates the short leg before the spot leg can be realised.',
        ],
        inApp: 'The **funding-rate carry** strategy is in the [library](/strategies) marked **signal-only, not executable** — this paper engine has no perpetual-futures instrument, so the trade cannot be placed. The signal is readable; the button would be a lie.',
        quiz: [
            {
                question: 'Why does a carry trade look excellent on a Sharpe ratio?',
                options: ['Returns are large', 'Returns are steady and low-variance for long periods — the risk sits in a rare tail the sample usually excludes', 'It has no drawdowns', 'Sharpe is the wrong formula'],
                answer: 1,
                why: 'Sharpe assumes roughly normal returns. Carry produces small steady gains punctuated by rare catastrophic ones, which is precisely the shape that measure cannot see.',
            },
            {
                question: 'What does uncovered interest parity predict, and what happens?',
                options: ['It predicts carry profits, and they occur', 'It predicts the high-yield currency depreciates by the differential — empirically it has often appreciated instead', 'It predicts nothing', 'It only applies to the dollar'],
                answer: 1,
                why: 'The persistent failure of UIP is the carry trade. The profit is compensation for tail risk rather than a free lunch.',
            },
        ],
    },

    {
        slug: 'fx-sessions',
        title: 'A 24-hour market with no volume',
        track: 'forex',
        level: 'advanced',
        kind: 'study',
        minutes: 7,
        outcome: 'Choose when to trade FX, and know what data the market structurally cannot give you.',
        where: { href: '/terminal', label: 'Check the session state' },
        prereq: ['fx-leverage'],
        concept: [
            'FX trades continuously from Monday morning in Asia to Friday evening in New York. There is no opening bell and no closing auction, because there is no exchange — it is a decentralised over-the-counter market between banks.',
            'Activity is nonetheless highly structured by **sessions**: Sydney, Tokyo, London, New York. Liquidity concentrates in the overlaps, and the **London–New York overlap** carries the heaviest volume of the day. Spreads are tightest there and widest in the late Asian afternoon.',
            'This has direct consequences. A range-breakout strategy that works during the London open behaves completely differently at 3am London time on the same pair — the price series is the same instrument, and the market underneath it is not. **The Asian-range → London-breakout** structure exists precisely because that transition is reliable.',
            'The structural absence matters more than the schedule, though: **there is no real volume data in spot FX.** No central exchange means no consolidated reporting, so any volume shown on a retail chart is that broker\'s own flow or a tick count. Volume-based analysis in spot FX analyses a number that does not measure market size.',
            'Weekend gaps are the other practical hazard. The market closes Friday and reopens Sunday evening, and everything that happened in between arrives at once as a gap. A stop-loss does not protect across a gap — it becomes a market order at whatever the reopening price is.',
        ],
        inApp: '`lib/sessions.ts` models market hours and DST via `Intl`, which is what lets `staleness.ts` say **closed** rather than **stale**. **VWAP is deliberately not offered on spot FX** in the strategy library, because there is no real volume to compute it from — this lesson, enforced in code.',
        quiz: [
            {
                question: 'When is FX liquidity deepest?',
                options: ['The Tokyo session', 'The London–New York overlap', 'Sunday evening', 'It is constant'],
                answer: 1,
                why: 'Spreads are tightest in the overlap and widest in the late Asian session. The same strategy behaves differently at different hours because the market underneath is different.',
            },
            {
                question: 'Why does this app refuse to offer VWAP on spot FX?',
                options: ['It is too slow to compute', 'There is no real volume in spot FX, so a volume-weighted price would be computed from a number that measures nothing', 'FX has no candles', 'Licensing'],
                answer: 1,
                why: 'No central exchange means no consolidated volume. Offering the indicator anyway would produce a plausible number with nothing behind it.',
            },
        ],
    },
];
