import type { Lesson } from '../types';

// Track: derivatives and options.
//
// The largest track. It was written when this app had NO options layer, and every
// lesson said so; PRs 46-50 built one, and this track was not updated for several
// releases — so it spent that time telling users the opposite of the truth. That is
// precisely the defect the project rule exists to prevent, and it happened here.
//
// What is true now: NIFTY and BANKNIFTY index options trade against a live NSE chain,
// with solved Greeks, multi-leg orders, an approximate margin model and cash settlement
// at expiry. What is still NOT true is stated lesson by lesson — no stock options, no
// historical chain to backtest against, no spot instrument to hedge with, and a margin
// model that is an approximation rather than SPAN.

export const DERIVATIVES_LESSONS: Lesson[] = [
    {
        slug: 'what-a-derivative-is',
        title: 'Derivatives: contracts about a price',
        track: 'derivatives',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Say what a derivative derives from, and why leverage is the point rather than a side effect.',
        where: { href: '/terminal', label: 'Back to the terminal' },
        concept: [
            'A **derivative** is a contract whose value comes from something else — a stock, an index, a currency, a barrel of oil. You are not trading the thing; you are trading an agreement about its price.',
            'They exist because two very different groups want opposite things from the same contract. A **hedger** — a farmer, an exporter, a fund manager — wants to remove a price risk they already carry. A **speculator** wants to take one on. The contract transfers risk from someone who has it to someone who wants it, and both sides get what they came for.',
            'The defining feature is **leverage**, and it is structural rather than incidental. You post margin — a fraction of the contract value — rather than paying for the underlying. Control a large exposure with a small amount of capital, and both gains and losses are computed on the large number while your account holds the small one.',
            'The two main families work differently. **Futures** obligate both sides: buyer must buy, seller must sell, at the agreed price on the agreed date. **Options** obligate only one: the buyer has a right and may walk away, the seller has an obligation and cannot.',
            'That asymmetry is the whole of options, and it is why the two instruments require completely different risk thinking. In a future, both parties face the same shape of risk. In an option, one party has capped loss and the other does not.',
        ],
        inApp: '**Options are here; futures are not.** [The option chain](/options) trades real NIFTY and BANKNIFTY contracts, cash-settled at expiry. There is still no futures instrument and no perpetual, so the futures half of this lesson is taught rather than practised.',
        quiz: [
            {
                question: 'What is the structural difference between a future and an option?',
                options: ['Futures are riskier', 'A future obligates both parties; an option obligates only the seller — the buyer holds a right', 'Options expire, futures do not', 'Futures need no margin'],
                answer: 1,
                why: 'The asymmetry is the entire point of an option. It is why buyer and seller face completely different loss profiles from the same contract.',
            },
            {
                question: 'Why do derivatives markets exist at all?',
                options: ['To generate exchange fees', 'To transfer price risk from those who carry it to those who want it', 'To increase volatility', 'For tax reasons'],
                answer: 1,
                why: 'Hedgers shed risk, speculators take it on. Both sides get what they came for, which is why the market clears.',
            },
        ],
    },

    {
        slug: 'futures-and-margin',
        title: 'Futures: mark to market, and the call you cannot ignore',
        track: 'derivatives',
        level: 'intermediate',
        kind: 'study',
        minutes: 9,
        outcome: 'Explain daily settlement and why a correct view can still liquidate you.',
        where: { href: '/funds', label: 'Look at margin in the paper book' },
        prereq: ['what-a-derivative-is'],
        concept: [
            'A **futures contract** commits both sides to a transaction at a set price on a set date. In India, index and stock futures are cash-settled: no shares change hands, only the difference.',
            'You post **initial margin** to open, and this is where most of the danger lives — not in the direction of the trade but in the mechanics of holding it.',
            'Futures are **marked to market daily**. Every day, the day\'s gain or loss is credited to or debited from your account in cash. This is not an accounting entry you can ignore until expiry: money leaves your account each losing day. When the balance falls below the **maintenance margin**, you receive a margin call, and if you cannot meet it your position is closed — by the broker, at whatever price is available.',
            'The consequence is the one that catches people. **You can be right about the direction and still be liquidated**, if the path there is rough enough. A position that would have been profitable at expiry is worth nothing to you if it was closed out three weeks earlier at the worst point of a drawdown. Futures traders are not only forecasting the destination; they are having to survive the route.',
            'Every futures contract also has an **expiry**. In India that has traditionally been the monthly cycle for stock futures, with index derivatives on a weekly cycle — a schedule SEBI has revised more than once, so verify the current calendar rather than trusting a remembered rule. Holding a view past expiry means **rolling**: closing the near contract and opening the far one, paying the spread and any difference between the two prices each time.',
            'A useful sanity check: the futures price is not a forecast. It is roughly the spot price plus the cost of carrying the position to expiry. When it differs from that, the difference is usually financing and dividends, not a prediction.',
        ],
        inApp: 'This paper engine has **no futures instrument**. It models margin for short equity positions only — a related but much simpler mechanic, and one you can see on [Funds](/funds).',
        formulas: [
            {
                label: 'Notional and leverage',
                expr: 'notional = lot size × price    ·    leverage = notional ÷ margin posted',
                terms: [{ sym: 'lot size', meaning: 'contracts trade in fixed quantities set by the exchange, not in single shares' }],
                worked: () => 'A ₹10,00,000 notional on ₹1,50,000 margin is about 6.7× leverage: a 15% adverse move wipes out the margin entirely.',
            },
        ],
        quiz: [
            {
                question: 'You are right about direction but the price moves violently against you first. What can happen?',
                options: ['Nothing, you profit at expiry', 'Daily mark-to-market can trigger a margin call and force liquidation before your view plays out', 'The broker waits', 'The position pauses'],
                answer: 1,
                why: 'Money physically leaves your account each losing day. A position closed at the worst point of the drawdown is worth nothing regardless of where the price ended up.',
            },
            {
                question: 'What is the futures price mostly made of?',
                options: ['A forecast of the future price', 'Spot plus the cost of carrying the position to expiry', 'The average of recent prices', 'An analyst consensus'],
                answer: 1,
                why: 'Carry — financing minus dividends — explains most of the basis. Reading a futures premium as a market prediction is a common and expensive mistake.',
            },
        ],
    },

    {
        slug: 'calls-and-puts',
        title: 'Calls and puts: the right, and the obligation',
        track: 'derivatives',
        level: 'intermediate',
        kind: 'study',
        minutes: 9,
        outcome: 'State the four basic positions and who faces unlimited loss in each.',
        where: { href: '/learn', label: 'Back to the track' },
        prereq: ['what-a-derivative-is'],
        concept: [
            'A **call** gives its buyer the right to buy the underlying at a fixed **strike price** before or at expiry. A **put** gives the right to sell at a strike. In both cases the buyer pays a **premium** for that right and may simply never use it.',
            'Every contract has a seller — the **writer** — who receives the premium and takes on the matching obligation. The buyer chooses; the writer must comply with that choice. There are therefore four basic positions, and they are not symmetric.',
            '**Long call.** Pay premium. Profit if the price rises well above the strike. **Maximum loss is the premium**, and that is a hard floor.',
            '**Long put.** Pay premium. Profit if the price falls well below the strike. Maximum loss is again the premium. This is how you hedge a holding without selling it.',
            '**Short call.** Receive premium. Profit if the price stays below the strike. **Maximum loss is unlimited** — there is no ceiling on how far a price can rise, and your obligation follows it all the way.',
            '**Short put.** Receive premium. Profit if the price stays above the strike. Maximum loss is large but bounded, because the price can only fall to zero. Economically it is close to agreeing to buy the stock at the strike, whatever happens.',
            'The distribution of outcomes is what makes options psychologically treacherous. **Selling options wins often and loses rarely and enormously.** A short-option book produces a long, comfortable run of small gains that feels like skill, and the entire loss can arrive in a single session. That shape has ended more accounts than any directional view, and it is a property of the instrument rather than of the trader.',
        ],
        inApp: 'You can do both on [the option chain](/options): click a premium to buy, or switch the ticket to **Write** to sell. Writing shows a margin requirement and a warning, because the asymmetry in this lesson is the whole reason those two buttons behave so differently.',
        quiz: [
            {
                question: 'Which position carries genuinely unlimited loss?',
                options: ['Long call', 'Long put', 'Short (written) call', 'Short put'],
                answer: 2,
                why: 'A price has no upper bound, and the writer\'s obligation follows it. A short put is bounded because the price can only fall to zero.',
            },
            {
                question: 'Why is a short-option book psychologically dangerous?',
                options: ['It is complicated', 'It wins often and loses rarely and enormously — a long comfortable run of small gains that feels like skill', 'It requires more capital', 'The fees are higher'],
                answer: 1,
                why: 'The payoff shape produces confidence that is not evidence. The whole loss can arrive in one session, and that is a property of the instrument.',
            },
        ],
    },

    {
        slug: 'intrinsic-and-time-value',
        title: 'Intrinsic and time value: what you are actually paying for',
        track: 'derivatives',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Split any option premium into its two components and see where the money goes.',
        where: { href: '/learn', label: 'Back to the track' },
        prereq: ['calls-and-puts'],
        visual: 'option-payoff',
        concept: [
            'Every option premium is exactly two things added together, and separating them explains most of what confuses beginners.',
            '**Intrinsic value** is what the option would be worth if it expired right now. For a call, the price minus the strike, floored at zero. It is never negative, because you would simply not exercise.',
            '**Time value** is everything else — the premium above intrinsic. It is the market\'s price for the possibility that things improve before expiry. It depends on how long is left and on how much the underlying is expected to move.',
            'The vocabulary follows from intrinsic value. **In the money** means positive intrinsic value. **At the money** means the strike is near the current price. **Out of the money** means zero intrinsic value: the option is currently worthless to exercise and is priced entirely on possibility.',
            'Here is the fact that decides more retail outcomes than any other in this track. **Time value decays to exactly zero at expiry, always, with certainty.** An out-of-the-money option consists of nothing but time value, so unless the underlying moves enough, its value goes to zero. Not "falls" — to zero.',
            'Cheap far-out-of-the-money options are attractive because they are cheap and the percentage returns in the winning case are spectacular. They are cheap because they usually expire worthless. Buying them repeatedly is not a strategy with a small edge; it is a strategy with a very low hit rate that needs the rare winner to be very large indeed to survive the arithmetic.',
            'And the decay is not linear. Time value erodes slowly at first and then accelerates sharply into the final days — which is why the last week before expiry behaves so differently from the rest of an option\'s life.',
        ],
        inApp: 'Open [the chain](/options) and compare a strike below the money with one above it. The out-of-the-money premium is pure time value — every paisa of it decays to zero by expiry unless the index moves.',
        formulas: [
            {
                label: 'The two components',
                expr: 'premium = intrinsic value + time value    ·    call intrinsic = max(0, price − strike)',
                terms: [{ sym: 'time value', meaning: 'the price of possibility — it reaches exactly zero at expiry' }],
                worked: () => 'Stock 1050, call strike 1000 trading at 70 → intrinsic 50, time value 20. If the stock stays at 1050, that 20 is gone by expiry.',
            },
        ],
        quiz: [
            {
                question: 'An out-of-the-money option is made of what?',
                options: ['Intrinsic value only', 'Time value only — which reaches exactly zero at expiry', 'Half of each', 'Neither'],
                answer: 1,
                why: 'No intrinsic value by definition. Its whole price is possibility, and possibility expires — which is why cheap far-OTM options usually end at zero.',
            },
            {
                question: 'How does time value decay over an option\'s life?',
                options: ['Linearly', 'Slowly at first, then accelerating sharply into the final days', 'All at once at expiry', 'It does not decay'],
                answer: 1,
                why: 'The acceleration into expiry is why the final week behaves so differently, and why holding a long option into it is a different trade from holding it a month out.',
            },
        ],
    },

    {
        slug: 'payoff-diagrams',
        title: 'Payoff diagrams: seeing the shape of a trade',
        track: 'derivatives',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Draw the payoff of any combination and find its break-even without arithmetic.',
        where: { href: '/learn', label: 'Back to the track' },
        prereq: ['intrinsic-and-time-value'],
        concept: [
            'A **payoff diagram** plots profit and loss at expiry against the underlying price. It is the single most useful tool in options, because it converts a position into a shape you can reason about at a glance.',
            'Each of the four basic positions has a characteristic shape. A **long call** is flat at minus the premium until the strike, then rises at 45 degrees — the "hockey stick". A **long put** is its mirror, falling to the left. A **short call** is the long call flipped: flat profit until the strike, then falling without limit. A **short put** is the mirror of that.',
            'The power comes from **addition**. Combine positions and the payoffs add. A long call at one strike plus a short call at a higher one gives a shape that rises and then flattens — a capped, cheaper bullish position. That is a **vertical spread**, and you can see what it does without any formula.',
            '**Break-even** falls out of the picture: it is where the shape crosses zero. For a long call it is strike plus premium — a fact worth internalising, because the option does not become profitable at the strike. It becomes profitable at the strike plus what you paid.',
            'One serious limitation, and it is the difference between the diagram and reality. **A payoff diagram shows expiry only.** Before expiry, the position is worth something different, because time value is still present and volatility can move the price of the option without the underlying moving at all. A trade that looks flat on the diagram can show substantial gains or losses two weeks before expiry.',
            'So the diagram tells you the destination, and the Greeks — next — tell you about the journey.',
        ],
        inApp: 'Place a single option on [the chain](/options), then watch it on [Holdings](/holdings) as the index moves. A spot position moves in a straight line; this one does not, and the bend is the strike.',
        quiz: [
            {
                question: 'Where does a long call break even?',
                options: ['At the strike', 'At the strike plus the premium paid', 'At the current price', 'Immediately'],
                answer: 1,
                why: 'The option becomes exercisable at the strike but does not repay its cost until the strike plus premium. That gap is the most common misreading of the diagram.',
            },
            {
                question: 'What does a payoff diagram NOT show?',
                options: ['Break-even', 'Maximum loss', 'Anything about the position\'s value before expiry, where time value and volatility still matter', 'The strike'],
                answer: 2,
                why: 'It is an expiry-only picture. Before expiry, volatility and remaining time can move the option price with the underlying unchanged.',
            },
        ],
    },

    {
        slug: 'the-greeks',
        title: 'The Greeks: what moves an option price',
        track: 'derivatives',
        level: 'advanced',
        kind: 'study',
        minutes: 10,
        outcome: 'Name the five sensitivities and say which one is quietly working against you.',
        where: { href: '/learn', label: 'Back to the track' },
        prereq: ['payoff-diagrams'],
        visual: 'greeks',
        concept: [
            'An option price responds to five things. The **Greeks** measure each sensitivity separately, which is what makes an options position analysable rather than mysterious.',
            '**Delta** — how much the option price moves per ₹1 move in the underlying. Roughly 0 to 1 for calls, 0 to −1 for puts. It doubles as an approximate probability of finishing in the money, and as the position\'s equivalent size in shares: a 0.4-delta call behaves like 40 shares.',
            '**Gamma** — how fast delta changes. It is largest at the money and near expiry. High gamma means your effective position size changes quickly underneath you, which is why an at-the-money option on expiry day is such a different animal from the same option a month earlier.',
            '**Theta** — time decay, the value lost per day. **Negative for buyers, positive for sellers**, always. It is the only Greek whose direction is certain: time passes whatever the market does. This is the one working quietly against every option buyer.',
            '**Vega** — sensitivity to implied volatility. Long options are long vega: they gain when expected volatility rises, even with the underlying unchanged. This is how a correctly-directional option trade can still lose money.',
            '**Rho** — sensitivity to interest rates. Usually the least important for short-dated positions.',
            'The relationships between them are what practitioners actually trade. **Gamma and theta oppose each other**: the position that gains most from movement is the one that bleeds most from stillness. You are paid for one by giving up the other, and there is no arrangement that is long both.',
            'The most common way a retail options trade fails is not being wrong about direction. It is **being right too slowly** — theta eroding the premium faster than the underlying moves, so the view is vindicated and the position still loses. An option is a bet on direction *and* magnitude *and* timing, and all three must be right.',
        ],
        inApp: '[The chain](/options) shows delta per strike, solved here with Black-Scholes rather than taken from NSE. Watch how delta approaches 1 deep in the money and 0 far out of it — that is the same number doubling as an approximate probability of finishing in the money.',
        formulas: [
            {
                label: 'The five sensitivities',
                expr: 'Δ = ∂V/∂S   ·   Γ = ∂Δ/∂S   ·   Θ = ∂V/∂t   ·   ν = ∂V/∂σ   ·   ρ = ∂V/∂r',
                terms: [
                    { sym: 'S', meaning: 'underlying price' },
                    { sym: 't', meaning: 'time' },
                    { sym: 'σ', meaning: 'implied volatility' },
                ],
                worked: () => 'A 0.4-delta call gains about ₹0.40 per ₹1 rise. With theta −2, it also loses about ₹2 a day regardless.',
            },
        ],
        quiz: [
            {
                question: 'Which Greek always works against an option buyer?',
                options: ['Delta', 'Gamma', 'Theta — time passes regardless of what the market does', 'Vega'],
                answer: 2,
                why: 'Theta is the only Greek with a certain direction. Every other sensitivity can help or hurt; decay only ever takes.',
            },
            {
                question: 'You are right about direction but the move takes four weeks instead of one. What likely happened?',
                options: ['You profited anyway', 'Theta eroded the premium faster than the underlying moved — right view, losing trade', 'Delta went negative', 'The option was exercised'],
                answer: 1,
                why: 'An option is a bet on direction, magnitude and timing together. Being right too slowly is the most common way a correct view still loses.',
            },
        ],
    },

    {
        slug: 'implied-volatility',
        title: 'Implied volatility, and the crush after the event',
        track: 'derivatives',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Read IV as a price rather than a forecast, and anticipate the post-event collapse.',
        where: { href: '/research', label: 'Check an earnings date' },
        prereq: ['the-greeks'],
        concept: [
            '**Implied volatility** is the volatility figure that, put into a pricing model, reproduces the option\'s actual market price. It is not measured from history — it is reverse-engineered from what people are paying.',
            'That makes it the cleanest available reading of **expected future movement**, and the honest way to describe an option\'s price. Options are not expensive or cheap in rupees; they are expensive or cheap in implied volatility, and comparing premiums across strikes or dates without it compares nothing.',
            'IV rises before known events — earnings, elections, policy decisions — because everyone can see the event coming and the option must cover it. Then, the moment the event passes, **IV collapses**. This is **volatility crush**, and it is the trap that catches more retail options buyers than any other single thing.',
            'The shape of that trap is worth stating exactly. You buy a call before earnings. The results are good. The stock rises 4%. **Your call loses money**, because you paid an inflated IV, the uncertainty resolved, and vega worked against you harder than delta worked for you. You were right about the event and lost anyway.',
            '**IV rank** or **IV percentile** — where current IV sits against its own past year — is the standard way to judge whether options are historically expensive. It is a far better guide than the absolute number, because normal IV differs enormously across instruments.',
            'The **volatility smile** is the other structural feature: options at different strikes trade at different IVs, with out-of-the-money puts typically carrying the highest. That is the market pricing crash risk, and it is a permanent feature rather than an inefficiency — a reminder that the market knows returns are not normally distributed even though the model assumes they are.',
        ],
        inApp: '[The chain](/options) solves implied volatility per strike. Some cells show a dash: far from the money, vega is so small that no volatility reproduces the price, and NSE reports zero on roughly a third of a live expiry for the same reason. A dash is the honest answer there — a number would be invented.',
        quiz: [
            {
                question: 'You buy a call before earnings, results are good, the stock rises 4%, and your call loses money. Why?',
                options: ['A calculation error', 'Volatility crush — you paid inflated IV and the uncertainty resolved, so vega cost more than delta gained', 'The option expired', 'Dividends'],
                answer: 1,
                why: 'IV is elevated before a known event and collapses after it. Being right about the event is not enough when you paid for uncertainty that has now disappeared.',
            },
            {
                question: 'What does the volatility smile show?',
                options: ['A pricing error', 'That out-of-the-money puts carry higher IV — the market pricing crash risk the model does not assume', 'That options are overpriced', 'Time decay'],
                answer: 1,
                why: 'It is a permanent structural feature, not an inefficiency. The market prices fat tails even though the pricing model assumes they do not exist.',
            },
        ],
    },

    {
        slug: 'spreads-and-combinations',
        title: 'Spreads: paying less by giving something up',
        track: 'derivatives',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Explain what each common structure trades away, and why nothing is free.',
        where: { href: '/strategies', label: 'See what is and is not built' },
        prereq: ['implied-volatility'],
        concept: [
            'Combining options builds positions with shapes a single option cannot produce. Every one of them is a trade: you give something up to get something.',
            '**Vertical spread** — buy one strike, sell a further one, same expiry. Cheaper than the bare option and less exposed to time decay. **What you gave up is the upside beyond the second strike.** This is the workhorse structure and usually the sensible first step beyond a single option.',
            '**Straddle** — buy a call and a put at the same strike. Profits from a large move in either direction. **What you gave up is stillness**: you paid two premiums, so a quiet market loses both. Straddles are bets on magnitude, and they are frequently bought at exactly the moment IV is highest.',
            '**Strangle** — the same idea with out-of-the-money strikes. Cheaper, and it needs a bigger move to pay.',
            '**Iron condor** — sell an out-of-the-money call spread and an out-of-the-money put spread. Profits if the price stays in a range. **What you gave up is the tails**: the wins are small and frequent, the losses large and rare. It is a short-volatility position wearing a defined-risk label, and the defined risk is often several times the credit received.',
            '**Calendar spread** — same strike, different expiries, profiting from the near option decaying faster than the far one.',
            'Two cautions that apply to all of them. **Costs multiply with legs**: a four-leg condor pays four spreads and four sets of charges to open and again to close, and in a less liquid chain those spreads dominate the expected profit. And **defined risk is not small risk** — the maximum loss on a condor is typically a multiple of the maximum gain, so a strategy that wins nine times out of ten can still lose money over a year.',
        ],
        inApp: 'Multi-leg orders are built: a spread places as ONE structure, and if any leg fails validation every leg is rejected together — a half-placed spread is a naked position nobody asked for. The [iron condor](/strategies/options/iron-condor) builds all four legs for you. One honest limit remains: **margin is computed per leg**, so a defined-risk structure is charged more here than a real broker would charge.',
        quiz: [
            {
                question: 'What does a vertical spread give up in exchange for costing less?',
                options: ['Nothing', 'The upside beyond the strike you sold', 'Its expiry date', 'Defined risk'],
                answer: 1,
                why: 'Selling the further strike funds part of the purchase and caps the payoff there. That cap is the price of the discount.',
            },
            {
                question: 'An iron condor wins 9 times out of 10. Is it profitable?',
                options: ['Yes, obviously', 'Not necessarily — the maximum loss is typically several times the maximum gain', 'Always', 'Only in trends'],
                answer: 1,
                why: 'Win rate without payoff ratio says nothing. Defined risk is not small risk, and the rare loss is sized to undo many wins.',
            },
        ],
    },

    {
        slug: 'expiry-and-assignment',
        title: 'Expiry: settlement, assignment, and the Indian calendar',
        track: 'derivatives',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Know what happens at expiry, and why an option seller can be assigned early.',
        where: { href: '/learn', label: 'Back to the track' },
        prereq: ['spreads-and-combinations'],
        concept: [
            'Expiry is the most mechanically dangerous moment in options, and most of the danger is procedural rather than directional.',
            '**Settlement style** decides what actually happens. **Cash-settled** contracts pay the difference — Indian index options work this way, and nothing is delivered. **Physically settled** contracts deliver the underlying: Indian *stock* options are physically settled, so an in-the-money position at expiry becomes an obligation to deliver or receive the actual shares, with the full contract value required. Traders who expected a small cash difference and instead faced a multi-lakh delivery obligation are a recurring category of expiry-day disaster.',
            '**Exercise style** decides when. **European** options can only be exercised at expiry — Indian index options are European. **American** options can be exercised any time, which means a seller can be **assigned early**, without warning, on any day. Short American options carry a timing risk that short European options do not.',
            'Then the rule that surprises people every cycle: **in-the-money options are usually exercised automatically at expiry**, even by a penny. A position you forgot about does not quietly disappear. It settles, and it can settle into a position or an obligation you did not intend to hold.',
            'The **Indian derivatives calendar has changed repeatedly**, and this is one place a remembered rule is worse than no rule. SEBI has revised the number of weekly expiries per exchange and raised contract sizes, with the stated intention of reducing retail speculation in short-dated options. **Check the current expiry schedule and lot sizes on the exchange website before trading — do not rely on this lesson, or any article, for the current values.**',
            'Practically: know your settlement style before you open the position, not on expiry day. And do not carry a short physically-settled stock option into expiry unless you can actually meet the delivery.',
        ],
        inApp: 'Index options here settle automatically at expiry, at intrinsic value against the index — European and cash-settled, as NSE\'s are. Two limits stated plainly: settlement uses the **last available index mark**, not NSE\'s 30-minute closing average, which this app does not have; and with no mark available the position is left open and reported as awaiting one rather than settled at an invented price. Stock options are not supported at all, because they settle physically.',
        quiz: [
            {
                question: 'You hold an in-the-money Indian STOCK option at expiry. What happens?',
                options: ['It expires worthless', 'It is cash-settled', 'Physical settlement — you must deliver or receive the actual shares, at full contract value', 'It rolls automatically'],
                answer: 2,
                why: 'Indian index options are cash-settled but stock options are physically settled. Expecting a cash difference and receiving a delivery obligation is a recurring expiry-day disaster.',
            },
            {
                question: 'Why does selling an American-style option carry a risk European sellers do not have?',
                options: ['Higher premium', 'You can be assigned early, on any day, without warning', 'It expires sooner', 'Higher margin'],
                answer: 1,
                why: 'European options can only be exercised at expiry; American ones any time. That timing uncertainty is a real risk for the writer.',
            },
        ],
        resources: [
            { kind: 'regulator', title: 'SEBI', url: 'https://www.sebi.gov.in/', why: 'Expiry schedules and contract sizes have changed repeatedly. Check the primary source, not an article.' },
        ],
    },

    {
        slug: 'fno-reality-check',
        title: 'What SEBI\'s own data says about retail F&O',
        track: 'derivatives',
        level: 'expert',
        kind: 'study',
        minutes: 9,
        outcome: 'Confront the base rate for retail derivatives trading in India before deciding to participate.',
        where: { href: '/portfolio', label: 'Look at your own record' },
        prereq: ['expiry-and-assignment'],
        concept: [
            'Everything to this point has been mechanics. This lesson is the base rate, and it belongs in the course because omitting it would misrepresent the activity.',
            '**SEBI has published repeated studies of individual traders in equity derivatives, and the finding has been consistent: roughly nine in ten lose money.** Not underperform an index — lose money outright. The studies also found that aggregate losses across individual traders run into tens of thousands of crores, that the average loser\'s loss is substantial relative to their income, and that the small profitable minority pays a large share of its gains back in transaction costs.',
            'Verify the current figures at the source below rather than trusting the numbers as remembered — the studies are periodically updated. The direction of the finding has not changed across versions.',
            'Why is the rate this bad, when index investing over the same period made money? Four structural reasons, none of which is about skill.',
            '**Leverage compresses the time you have to be right.** A cash position can be wrong for a year and recover. A leveraged one cannot be wrong for a week.',
            '**Costs are enormous relative to the premium.** On a short-dated option costing ₹15, brokerage, STT, exchange fees, GST and the bid-ask spread can consume a large fraction before the position moves at all. High-frequency trading of cheap options is a costs problem disguised as a strategy problem.',
            '**Theta is a constant tax on buyers.** Most retail volume is in buying short-dated options, which is the side that pays decay every single day.',
            '**And the counterparty is not another retail trader.** The other side of most retail options flow is a professional market maker with better pricing models, lower costs, hedged exposure and no directional view at all. They do not need to predict the market to make money from the spread.',
            'What follows is not "never trade derivatives". Hedging a real holding with a put is a sound and conservative use, and the instruments exist for good reasons. What follows is that **the burden of proof is on you**, that this base rate applies until you have your own evidence against it, and that paper trading with real costs is the cheapest way to gather that evidence.',
        ],
        inApp: 'This app now simulates index options with real premiums and the real charge schedule — flat brokerage per leg, STT on the sell side on premium, settlement STT on intrinsic. [Portfolio](/portfolio) shows what that record looks like over time, and it is the only evidence about you specifically that is worth anything.',
        quiz: [
            {
                question: 'What have SEBI\'s studies of individual equity-derivatives traders consistently found?',
                options: ['Most beat the index', 'Results are evenly split', 'Roughly nine in ten lose money outright', 'Most break even'],
                answer: 2,
                why: 'The finding has been consistent across versions of the study: about nine in ten lose money, not merely underperform. Check the current numbers at the source.',
            },
            {
                question: 'Who is on the other side of most retail options flow?',
                options: ['Another retail trader', 'A professional market maker with better models, lower costs and a hedged book', 'The exchange', 'A mutual fund'],
                answer: 1,
                why: 'Market makers profit from the spread without needing a directional view. That structural asymmetry is a large part of the base rate.',
            },
        ],
        resources: [
            { kind: 'regulator', title: 'SEBI investor education and research', url: 'https://investor.sebi.gov.in/', why: 'The regulator\'s own published studies of retail derivatives outcomes. Primary source, periodically updated.' },
        ],
    },

    {
        slug: 'hedging-with-options',
        title: 'Hedging: the use case that actually holds up',
        track: 'derivatives',
        level: 'expert',
        kind: 'study',
        minutes: 9,
        outcome: 'Price a protective put honestly, including the cost of the insurance itself.',
        where: { href: '/portfolio', label: 'Look at your concentration' },
        prereq: ['fno-reality-check'],
        concept: [
            'After the previous lesson it would be easy to conclude options are simply a bad idea. That would be wrong, and the distinction matters: **the losing use is speculation on direction; the sound use is transferring a risk you already hold.**',
            '**A protective put** is the clearest case. You own a stock, you buy a put at a strike below the current price, and your downside is bounded at that strike for the option\'s life. It is insurance, and it prices like insurance — you pay a premium and most of the time it expires worthless. That is the *expected* outcome, not the failure case, and understanding this is what separates hedging from a losing bet.',
            'The honest arithmetic is a drag calculation. A put costing 2% of the position, bought four times a year, costs roughly 8% annually before considering what it saves. **Continuous hedging is expensive enough to consume most of a typical equity return.** Which is why the sensible applications are specific rather than permanent: a concentrated position you cannot sell, a known event you want to hold through, a portfolio near a goal where the loss would be more costly than the premium.',
            '**A covered call** is the other common structure: you own the stock and sell a call against it, receiving premium and capping your upside at the strike. It generates income in flat markets. What it gives up is the large upward move, and since a small number of very large up-moves account for a disproportionate share of long-run equity returns, systematically selling them away has a real cost that a monthly income figure hides.',
            '**A collar** combines both — buy a protective put, fund it by selling a call. Cheap or free protection, with the upside sold to pay for it.',
            'The question that decides whether any hedge is worth it: **what specifically am I protecting against, and what would happen if I did not?** If the answer is "the market might fall" and you would simply hold through it, the hedge is a cost with no purpose. If the answer is "this position is 60% of my net worth and I need the money in eighteen months", the premium may be the cheapest thing you buy all year.',
        ],
        inApp: 'You can buy a protective put on [the chain](/options) — though note it hedges the INDEX, not your individual holdings, so it is a rough hedge for an Indian equity book rather than an exact one. [Portfolio](/portfolio) shows the concentration that would need protecting.',
        formulas: [
            {
                label: 'The cost of continuous protection',
                expr: 'annual drag ≈ put cost as % of position × hedges per year',
                terms: [{ sym: 'drag', meaning: 'the return given up in exchange for the bounded downside' }],
                worked: () => 'A 2% put bought quarterly costs about 8% a year — a large share of a typical equity return, which is why permanent hedging rarely makes sense.',
            },
        ],
        quiz: [
            {
                question: 'Your protective put expires worthless. What happened?',
                options: ['You wasted money', 'The expected outcome — insurance usually expires unused, and that is what buying protection means', 'You mispriced it', 'You should have sold it'],
                answer: 1,
                why: 'A hedge that usually pays out would be priced accordingly. Expecting the premium to be lost most of the time is what distinguishes hedging from a directional bet.',
            },
            {
                question: 'What does systematically selling covered calls give up?',
                options: ['Nothing', 'The rare large up-moves, which account for a disproportionate share of long-run equity returns', 'Dividends', 'Voting rights'],
                answer: 1,
                why: 'The monthly income is visible and the forgone tail is not. Long-run equity returns are concentrated in a small number of large up-moves.',
            },
        ],
    },

    {
        slug: 'options-in-this-app',
        title: 'What this simulator models, approximates, and refuses',
        track: 'derivatives',
        level: 'expert',
        kind: 'study',
        minutes: 6,
        outcome: 'Know exactly what this simulator models, what it approximates, and what it refuses to model at all.',
        where: { href: '/options', label: 'Open the chain' },
        prereq: ['hedging-with-options'],
        concept: [
            'This lesson used to say the opposite of what follows. For several releases it told you this app had no options layer — which was true when it was written and false from the moment one shipped. It is worth knowing that happened, because it is exactly the failure this course warns about, and a codebase is not exempt from its own rule.',
            '**What is real.** Index options on NIFTY and BANKNIFTY trade against a live NSE chain: real strikes, real expiries, real premiums, real bid and ask, real open interest. Lot sizes are parsed from NSE\'s own contract master per expiry rather than hardcoded. Greeks and implied volatility are solved here with Black-Scholes. Multi-leg structures place atomically, and positions settle at expiry against the index.',
            '**What is approximated, and labelled as such.** Margin is a documented approximation, not SPAN — the screen says so, and it is computed **per leg**, so a defined-risk spread is charged more here than a real broker would charge. Settlement uses the last available index mark rather than NSE\'s 30-minute closing average. Both of those are visible in the UI rather than buried.',
            '**What is refused rather than faked.** Where no underlying mark exists at expiry, the position is left open and reported as awaiting one — not settled at an invented price. Where no volatility reproduces an option\'s price, the implied-volatility cell shows a dash rather than a number.',
            '**What genuinely is not here.** Stock options, because they settle physically and are American-style — a different engine. Futures and perpetuals. A spot index instrument, which is why gamma scalping can be signalled but not hedged. And **historical option chains**, because no free source publishes them: a nightly snapshot has begun accumulating history, but until there is enough, options strategies can be traded live and tested only against a clearly-labelled synthetic chain.',
            'That last one is the most important limitation in this track. A synthetic chain prices every strike at the underlying\'s own realised volatility with no skew — so implied equals realised by construction, and any strategy whose edge is the gap between them cannot fire at all. Three of the four options strategies here are in exactly that position, and the backtester says so rather than reporting a silent zero.',
        ],
        inApp: '[The option chain](/options) is the live surface. [The options strategies](/strategies) list the four structures, each with its own backtest against a synthetic chain and a warning that says what that does and does not show. [What is not here](/strategies/unavailable) tracks the rest.',
        quiz: [
            {
                question: 'What can this app do with index options today?',
                options: [
                    'Nothing — options are not implemented',
                    'Trade a live NSE chain with solved Greeks, multi-leg orders and cash settlement at expiry',
                    'Only display prices, with no trading',
                    'Trade both index and stock options',
                ],
                answer: 1,
                why: 'All four pieces are built. Stock options are the exception — they settle physically and are American-style, which is a different engine this app does not have.',
            },
            {
                question: 'Why can three of the four options strategies not be backtested here yet?',
                options: [
                    'They are not implemented',
                    'No free source publishes historical option chains, and a synthetic chain has implied equal to realised by construction — so a volatility-edge strategy has no gap to find',
                    'They are too slow to run',
                    'The margin model is an approximation',
                ],
                answer: 1,
                why: 'It is a property of the data rather than a verdict on the strategies. The backtester reports it explicitly, because "0 trades" without an explanation reads as "the strategy never triggered", which is a different and much more damning claim.',
            },
            {
                question: 'At expiry, no mark for the underlying is available. What happens to your position?',
                options: [
                    'It settles at the last option premium',
                    'It settles at zero',
                    'It is left open and reported as awaiting a settlement mark',
                    'It is cancelled',
                ],
                answer: 2,
                why: 'Fabricating a settlement price is the most tempting unsafe shortcut in this whole feature, and it is refused deliberately. A written option also keeps its margin held, which is what a real broker does.',
            },
        ],
    },
];
