import type { Lesson } from '../types';

// Track: India equity (continuation).
//
// The six lessons that complete the track. `indiaEquity.ts` holds the first four;
// these are appended after it so within-track prerequisites still resolve backwards.

export const INDIA_EQUITY_ADVANCED: Lesson[] = [
    {
        slug: 'nifty-and-sensex',
        title: 'Nifty and Sensex: what the index actually holds',
        track: 'india-equity',
        level: 'foundation',
        kind: 'study',
        minutes: 7,
        outcome: 'Explain how the Indian indices are built and what rebalancing does to a stock.',
        where: { href: '/terminal', label: 'Back to the terminal' },
        prereq: ['nse-bse-and-sebi'],
        concept: [
            'The **Nifty 50** holds 50 large companies on the NSE; the **Sensex** holds 30 on the BSE. Both are weighted by **free-float market capitalisation** — company value counted only over shares actually available to trade, excluding promoter and government holdings that never come to market.',
            'That free-float adjustment matters more in India than in most markets, because Indian promoter holdings are frequently large. A company with a 75% promoter stake counts at a quarter of its total market value, so its index weight is much smaller than its headline size suggests.',
            'Constituents are reviewed periodically against liquidity and market-cap criteria. Inclusion and exclusion are announced in advance, and the announcement itself moves the stock: **index funds must buy what enters and sell what leaves**, mechanically, regardless of price. That is forced flow with a known date, and it is visible in the price around every rebalance.',
            'Two things the index level does not tell you. It is a **price** index in its headline form, so it excludes dividends — total-return versions exist and are higher. And it says nothing about **breadth**: the Nifty can rise while most of its constituents fall, because a handful of large weights dominate.',
            'The broader classification is worth knowing because it drives fund mandates. SEBI defines **large cap** as the top 100 companies by market capitalisation, **mid cap** as 101 to 250, and **small cap** as everything below. These are rank-based, not value-based — which means a company can change category without its own value changing at all, purely because others moved around it.',
        ],
        inApp: 'This app trades individual instruments rather than indices. `^NSEI` is available as a data symbol — the leading `^` is why `SYMBOL_RE` in `lib/marketData/universe.ts` permits it as a first character.',
        quiz: [
            {
                question: 'A company with a 75% promoter stake joins the Nifty. How is it weighted?',
                options: ['By full market cap', 'By free float — roughly a quarter of its total value, since promoter holdings are excluded', 'Equally with all constituents', 'By revenue'],
                answer: 1,
                why: 'Free-float weighting counts only tradeable shares. With large Indian promoter holdings, index weight can be far below headline market cap.',
            },
            {
                question: 'Why does an index inclusion announcement move the stock?',
                options: ['Analysts upgrade it', 'Index funds must buy it mechanically regardless of price — forced flow with a known date', 'It becomes safer', 'SEBI requires it'],
                answer: 1,
                why: 'Passive funds tracking the index have no discretion. The flow is predictable in direction and timing, which is why it is visible around every rebalance.',
            },
        ],
    },

    {
        slug: 'india-order-types',
        title: 'The NSE session: pre-open, order types and the close',
        track: 'india-equity',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Use the right order type at the right point in the session.',
        where: { href: '/orders', label: 'Place an order' },
        prereq: ['intraday-vs-delivery'],
        visual: 'order-book',
        concept: [
            'The NSE equity day has a structure, and using a market order at the wrong point in it is a self-inflicted cost.',
            'The **pre-open session** runs for fifteen minutes before 9:15am. Orders are collected and a single **equilibrium price** is computed that maximises executable volume — a call auction rather than continuous trading. This exists to prevent the opening price being set by whoever happened to trade first, and it is why the open can differ sharply from the previous close without any continuous trading in between.',
            'Continuous trading then runs to 3:30pm, matching on **price-time priority**: better prices first, and among equal prices, whoever queued earlier.',
            'The order types are worth using deliberately. A **market** order takes whatever is available and guarantees execution but not price — dangerous in illiquid stocks and at the open, where the spread is widest. A **limit** order guarantees price but not execution. A **stop-loss** becomes a market order when triggered, so it inherits every market-order risk exactly when conditions are worst. A **stop-loss limit** becomes a limit order instead, which protects against a terrible fill but may not execute at all in a fast move — a real trade-off with no free answer.',
            'Two India-specific mechanics. **Intraday positions are squared off by your broker** before the close, at whatever price exists, with a charge for the service — which is why a serious intraday strategy flattens itself first. And **circuit filters can make a limit order unfillable** entirely, as the circuit lesson describes.',
        ],
        inApp: 'This app supports market, limit and stop orders, and `MarketEngine` matches resting orders every second. **The pre-open auction is not modelled** — the simulator trades continuously — so opening fills here are cleaner than reality.',
        quiz: [
            {
                question: 'What does the pre-open session do?',
                options: ['Allows early trading', 'Runs a call auction that computes one equilibrium price maximising executable volume', 'Sets the circuit limits', 'Cancels overnight orders'],
                answer: 1,
                why: 'It prevents the open being set by whoever trades first. That is also why the open can gap from the previous close with no continuous trading in between.',
            },
            {
                question: 'What is the trade-off between a stop-loss and a stop-loss limit?',
                options: ['There is none', 'A stop-loss guarantees execution but not price; a stop-loss limit guarantees price but may not execute in a fast move', 'Stop-loss limits are always better', 'They are the same'],
                answer: 1,
                why: 'A plain stop becomes a market order exactly when conditions are worst. A stop-limit protects the price and can leave you in the position.',
            },
        ],
    },

    {
        slug: 'corporate-actions',
        title: 'Corporate actions: when the price changes and nothing happened',
        track: 'india-equity',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Recognise a mechanical price adjustment and stop reading it as a crash.',
        where: { href: '/holdings', label: 'Check your holdings' },
        prereq: ['nse-bse-and-sebi'],
        concept: [
            'A **corporate action** changes the shares or the cash attached to them, and several of them change the quoted price without changing the value of what you hold. Reading one as a market move is a recurring beginner error, and it also corrupts backtests.',
            '**Dividend.** Cash paid per share. On the **ex-dividend date** the price drops by roughly the dividend, because the buyer from that day no longer receives it. You are not poorer — the value moved from the share price into cash due to you.',
            '**Stock split.** One share becomes several, each proportionally cheaper. A 1:5 split turns one ₹1,000 share into five ₹200 shares. Nothing changed except divisibility, which improves liquidity for small buyers.',
            '**Bonus issue.** Additional shares issued free from reserves, with the price adjusting down proportionally. Economically almost identical to a split, accounted for differently.',
            '**Rights issue.** Existing shareholders get the right to buy new shares at a discount. This one is not neutral: if you do not participate you are diluted, and the right itself has value that can often be sold separately.',
            '**Buyback.** The company purchases its own shares, reducing the count and raising per-share metrics. Announcements often lift the price, and the tax treatment of buyback proceeds in India has been changed by recent budgets — check the current position rather than a remembered one.',
            'The practical warning that matters most: **historical price data must be adjusted for these, and not all sources do it.** An unadjusted series shows a 1:5 split as an 80% single-day crash. Any strategy tested on unadjusted data will find spectacular fake signals, and it is one of the most common silent errors in backtesting.',
        ],
        inApp: 'Candles here come from providers that generally return split- and dividend-adjusted series. **This app does not itself apply corporate-action adjustments**, so an unadjusted provider series would be passed through as-is — worth knowing before trusting a very long backtest.',
        quiz: [
            {
                question: 'A stock drops 4% on its ex-dividend date. What happened?',
                options: ['Bad news', 'A mechanical adjustment — the buyer from that day no longer receives the dividend', 'A market crash', 'Manipulation'],
                answer: 1,
                why: 'Value moved from the share price into cash due to you. Reading it as a price move is both a beginner error and a source of fake backtest signals.',
            },
            {
                question: 'Why is unadjusted historical data dangerous for backtesting?',
                options: ['It is slower to load', 'A 1:5 split appears as an 80% single-day crash, producing spectacular fake signals', 'It has gaps', 'It costs more'],
                answer: 1,
                why: 'Corporate actions appear as enormous price moves that never happened. It is one of the most common silent errors in backtesting.',
            },
        ],
    },

    {
        slug: 'margin-in-india',
        title: 'Margin: what leverage is actually available',
        track: 'india-equity',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Understand upfront margin collection and why intraday leverage is far lower than it used to be.',
        where: { href: '/funds', label: 'See your buying power' },
        prereq: ['intraday-vs-delivery'],
        concept: [
            'Indian margin rules were substantially tightened, and any material written before that change describes leverage that no longer exists. This lesson describes the structure rather than the multiples, because the multiples are set by regulation and revised.',
            'The central change was **upfront margin collection**. Brokers must collect the prescribed margin before the trade rather than settling up afterwards, and there are penalties for shortfalls. The practical effect was that the very high intraday leverage brokers used to advertise — often 10× to 20× — largely disappeared.',
            'Margin is computed from **SPAN plus exposure** for derivatives, and from a prescribed **VaR plus extreme loss margin** framework for equity, so the requirement varies by stock volatility rather than being one flat number. A volatile small cap requires far more margin than a large cap, which is the system doing something sensible.',
            '**Peak margin reporting** means your requirement is assessed on intraday snapshots rather than end-of-day. A position that was large mid-session and flat by the close still incurred the peak requirement, which catches people who assumed only the closing position counted.',
            '**Pledging** lets you use existing holdings as collateral, with a haircut, to obtain margin — and since a rule change, pledged shares stay in your own demat account rather than being transferred to the broker. That is a genuine protection worth knowing about.',
            'The honest framing of the whole change: **the rules reduced leverage, and the retail loss statistics were the reason.** Whether you regard that as protection or restriction, the practical position is that Indian intraday leverage is now modest, and any source promising otherwise is either out of date or not describing a regulated route.',
        ],
        inApp: '[Funds](/funds) shows buying power and margin held. This simulator models margin for **short equity positions only** — it has no SPAN model and no derivatives, so it is a simplification rather than a replica of the real framework.',
        quiz: [
            {
                question: 'What did upfront margin collection change in practice?',
                options: ['Nothing material', 'The very high advertised intraday leverage largely disappeared — margin must be collected before the trade', 'It raised brokerage', 'It applies only to derivatives'],
                answer: 1,
                why: 'Collecting before rather than settling after removed the mechanism that made 10-20x intraday leverage possible. Older material describes leverage that no longer exists.',
            },
            {
                question: 'What does peak margin reporting mean?',
                options: ['Only the closing position counts', 'The requirement is assessed on intraday snapshots — a position flat by the close still incurred its peak requirement', 'Margin is charged monthly', 'It applies to delivery only'],
                answer: 1,
                why: 'Assuming only the end-of-day position matters is a common and expensive misunderstanding of the current framework.',
            },
        ],
    },

    {
        slug: 'surveillance-frameworks',
        title: 'ASM, GSM and the stocks the exchange is watching',
        track: 'india-equity',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Check a stock\'s surveillance status before buying, and know what it does to your ability to exit.',
        where: { href: '/scanner', label: 'Back to the scanner' },
        prereq: ['circuit-filters'],
        concept: [
            'The exchanges run surveillance frameworks that place unusual stocks under restrictions. They are published, checkable before you buy, and routinely ignored by the people most affected by them.',
            '**ASM** — additional surveillance measure — applies to stocks showing unusual price or volume behaviour. It typically brings higher margin requirements, and in stages, restrictions such as trade-for-trade settlement, which removes intraday netting entirely: every buy must be taken to delivery.',
            '**GSM** — graded surveillance measure — targets securities with weak fundamentals or governance concerns. Its stages escalate sharply, and at higher stages a stock may trade only in periodic call auctions, perhaps weekly, with a large deposit required from buyers.',
            'The consequence that matters is about **exit, not entry**. At higher GSM stages you can be left holding a position that trades once a week in an auction, in a security nobody wants to buy. It is not that your loss is larger — it is that you cannot act on it at all.',
            'Two behavioural points follow. **Surveillance placement is itself information**: the exchange has flagged something anomalous, and being the person who buys after that flag requires a reason. And the placement often arrives **after** a large run-up, catching exactly the people who bought into the momentum that triggered it.',
            'The check takes a minute on the exchange website and is worth making a habit before any small-cap purchase. It is the cheapest piece of due diligence available in Indian equity.',
        ],
        inApp: '**This app does not model surveillance frameworks or fetch ASM/GSM lists.** The simulator will always fill you, which makes trading flagged small caps here materially easier than in reality.',
        quiz: [
            {
                question: 'What is the main risk of a higher GSM stage?',
                options: ['Higher brokerage', 'The stock may trade only in periodic call auctions — you can be unable to exit at all', 'It is delisted immediately', 'Dividends stop'],
                answer: 1,
                why: 'The problem is not a larger loss, it is the inability to act on one. A weekly auction in a security nobody wants is not a market you can leave.',
            },
            {
                question: 'When is surveillance placement typically announced?',
                options: ['Before any price move', 'Often after a large run-up — catching the people who bought into the momentum that triggered it', 'Randomly', 'Only at year end'],
                answer: 1,
                why: 'The frameworks respond to anomalous behaviour, so the flag follows the move. Checking before buying is a one-minute habit that avoids this.',
            },
        ],
    },

    {
        slug: 'small-and-mid-caps',
        title: 'Small caps: where liquidity risk actually lives',
        track: 'india-equity',
        level: 'expert',
        kind: 'study',
        minutes: 8,
        outcome: 'Size a small-cap position by exit capacity rather than by conviction.',
        where: { href: '/portfolio', label: 'Check your concentration' },
        prereq: ['surveillance-frameworks'],
        concept: [
            'Small caps are where the largest returns and the largest permanent losses both live, and the reason is the same in both cases: **there are fewer participants on the other side.**',
            'The attraction is genuine. Institutional coverage is thin, so mispricing is more likely to persist; the businesses are smaller, so growth from a low base can be dramatic; and mandate restrictions keep large funds out entirely, leaving the field to individual investors.',
            'The risk is not primarily that they fall further, though they do. It is **liquidity**, which behaves in a specific and non-obvious way: it is present when you do not need it and absent when you do. In good conditions a small cap trades adequately. In a decline the buyers disappear, and the same position that took a day to accumulate takes weeks to exit — at prices that fall as you sell.',
            'This compounds with everything else in this track. Small caps have **narrower circuit bands**, so they lock limit-down more easily. They are the stocks most likely to be placed under **ASM or GSM**, adding restrictions exactly when you want out. And they are where **promoter pledging** is most common, so a decline can trigger forced lender selling into a market with no bids.',
            'The rule that follows is a sizing rule rather than a selection rule: **size a small-cap position by how much you could exit in a bad week, not by how much you want to own.** A position you cannot exit is not an investment you can manage; it is one you can only watch.',
            'Indian small-cap cycles have historically been violent in both directions, with drawdowns far exceeding large-cap ones in the same episode. Holding through that is a real requirement, not a hypothetical one, and it should be decided before rather than during.',
        ],
        inApp: '**This simulator does not model depth, circuit filters or surveillance restrictions** — it fills you at the quoted price in any size. Paper trading small caps here is meaningfully easier than the real thing, and that gap is exactly this lesson.',
        quiz: [
            {
                question: 'How should a small-cap position be sized?',
                options: ['By conviction', 'By how much you could exit in a bad week', 'By percentage of the index weight', 'The same as a large cap'],
                answer: 1,
                why: 'Liquidity is present when you do not need it and absent when you do. A position you cannot exit is one you can only watch.',
            },
            {
                question: 'Why do small-cap risks compound rather than add?',
                options: ['They do not', 'Thin liquidity, narrower circuit bands, surveillance restrictions and promoter pledging all bite at the same time — during a decline', 'Higher fees', 'Less coverage'],
                answer: 1,
                why: 'Each risk is triggered by the same event, so they arrive together. That is what turns an ordinary decline into a position you cannot leave.',
            },
        ],
    },
];
