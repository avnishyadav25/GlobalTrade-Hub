import type { Lesson } from '../types';

// Track: India equity.
//
// The market this app is denominated in, and the one whose rules most often surprise
// people who learned trading from American sources. Everything time-sensitive — tax
// rates above all — carries a verification date and a link, because a budget changes
// them and a confidently wrong number in a lesson about money is worse than no lesson.

export const RATES_VERIFIED_ON = 'August 2026';

export const INDIA_EQUITY_LESSONS: Lesson[] = [
    {
        slug: 'nse-bse-and-sebi',
        title: 'NSE, BSE and who is watching',
        track: 'india-equity',
        level: 'foundation',
        kind: 'study',
        minutes: 7,
        outcome: 'Name the exchanges, the regulator and the depositories, and say what each actually does.',
        where: { href: '/terminal', label: 'Open the Terminal' },
        visual: {
            kind: 'nested',
            caption: "Your shares are not at your broker. That single fact is the biggest structural protection Indian retail investors have.",
            steps: [
                { label: "SEBI", note: "writes the rules", tone: 'accent' },
                { label: "NSE / BSE", note: "match the orders" },
                { label: "NSDL / CDSL", note: "hold your shares, in your name", tone: 'up' },
                { label: "your broker", note: "routes and holds cash only", tone: 'warn' },
            ],
        },
        concept: [
            'India has two significant stock exchanges. The **BSE**, founded in 1875, is the older — Asia\'s first. The **NSE**, which opened in 1994, is where the overwhelming majority of equity volume now trades. Most liquid stocks are listed on both, and the prices track each other closely because arbitrageurs make money whenever they do not.',
            '**SEBI** is the regulator. It is not a participant: it writes the rules, licenses the brokers and exchanges, and punishes people who break them. When you read that a stock has been moved to a surveillance list, or that intraday leverage was reduced, that is SEBI.',
            'Your shares do not live at your broker. They live in a **depository** — either **NSDL** or **CDSL** — in a demat account in your own name. This matters more than it sounds: if your broker fails, your shares are still yours and still there. It is the single biggest structural protection Indian retail investors have, and most do not know it exists.',
            'The broker is a messenger. It routes your order to the exchange, and it holds your cash. Cash at a failing broker is a genuine risk; shares in your demat account are not, which is why "keep only what you are trading" is sound advice.',
        ],
        inApp: 'This app is a simulator — it has no broker connection for Indian equity, so nothing here touches a real demat account. The [Settings](/settings) screen is where a real connection would be configured.',
        quiz: [
            {
                question: 'Your broker goes bankrupt. What happens to shares you already own?',
                options: ['They are lost', 'They are frozen for years', 'They remain yours, held at the depository in your name', 'They transfer to the exchange'],
                answer: 2,
                why: 'Shares sit in your demat account at NSDL or CDSL, in your name — not on the broker\'s balance sheet. Cash held with the broker is a different and real risk, which is why traders keep working capital there and not savings.',
            },
            {
                question: 'What is SEBI\'s role?',
                options: ['It runs the NSE', 'It regulates the market and licenses its participants', 'It sets share prices', 'It holds your shares'],
                answer: 1,
                why: 'SEBI regulates; the exchanges operate; the depositories custody. Confusing the three makes it hard to know who to complain to when something goes wrong.',
            },
        ],
        resources: [
            { kind: 'article', title: 'Varsity: Introduction to Stock Markets', by: 'Zerodha', url: 'https://zerodha.com/varsity/module/introduction-to-stock-markets/', why: 'Chapter by chapter on exactly this, written for the Indian market.' },
            { kind: 'regulator', title: 'SEBI Investor Website', url: 'https://investor.sebi.gov.in/', why: 'The regulator\'s own investor education material, and where to file a complaint.' },
        ],
    },

    {
        slug: 'intraday-vs-delivery',
        title: 'Intraday or delivery: the choice that changes everything',
        track: 'india-equity',
        level: 'foundation',
        kind: 'study',
        minutes: 8,
        outcome: 'Choose the right product type, and know what it costs you in tax, margin and risk.',
        where: { href: '/funds', label: 'See your charges' },
        visual: {
            kind: 'split-bar',
            caption: "The same \u20b91,00,000 round trip, charged two ways. The gap is almost entirely STT.",
            steps: [
                { label: "intraday", note: "8.24 bps", tone: 'up', value: 824 },
                { label: "delivery", note: "23.57 bps", tone: 'down', value: 2357 },
            ],
        },
        prereq: ['nse-bse-and-sebi'],
        concept: [
            'Every Indian equity order carries a product type, and it is not a formality. **MIS** (intraday) means the position must be closed the same day. **CNC** (delivery) means the shares are actually credited to your demat account.',
            'The differences compound. Intraday gives you leverage — you can control more than your cash — and charges **STT at 0.025% on the sell leg only**. Delivery gives no leverage and charges **STT at 0.1% on both legs**: four times the rate, twice over. On a ₹1,00,000 round trip that is roughly ₹25 against ₹200.',
            'Intraday also carries a deadline you did not choose. Your broker will square off any open MIS position shortly before the close, at whatever price the market offers, and charge you for doing it. That is why a serious intraday strategy flattens itself first.',
            'The tax treatment differs too, and by more than most people expect: intraday equity is **speculative business income**, not capital gains. It is taxed at your slab rate, and it cannot be set off against capital losses. Delivery is capital gains, with a holding period that decides the rate.',
            'The honest summary: intraday is cheaper per trade and far more expensive per mistake.',
        ],
        inApp: 'This app models the **intraday** cost structure, which is stated in `paperEngine` and reflected on [Funds](/funds). A delivery book would pay noticeably more in STT.',
        formulas: [
            {
                label: 'Securities Transaction Tax',
                expr: 'intraday: 0.025% on SELL only    ·    delivery: 0.1% on BOTH legs',
                terms: [{ sym: 'STT', meaning: 'a tax on the transaction, not on the profit — you pay it whether you win or lose' }],
                worked: () => 'On a ₹1,00,000 round trip: about ₹25 intraday, about ₹200 delivery.',
            },
        ],
        quiz: [
            {
                question: 'You buy and sell ₹1,00,000 of a stock the same day. Roughly what STT do you pay?',
                options: ['₹200 — 0.1% both ways', '₹25 — 0.025% on the sell only', 'Nothing, STT is delivery only', '₹100'],
                answer: 1,
                why: 'Intraday STT is sell-side only at 0.025%. That asymmetry is a large part of why intraday strategies can survive costs that would destroy the same strategy held for delivery.',
            },
            {
                question: 'How is intraday equity profit taxed in India?',
                options: ['Long-term capital gains', 'Short-term capital gains', 'Speculative business income, at your slab rate', 'It is tax free below ₹1 lakh'],
                answer: 2,
                why: 'Intraday equity is speculative business income. It is taxed at your slab rate and cannot be set off against capital losses — a distinction that surprises people at their first filing.',
            },
        ],
        resources: [
            { kind: 'article', title: 'Varsity: Markets and Taxation', by: 'Zerodha', url: 'https://zerodha.com/varsity/module/markets-and-taxation/', why: 'The clearest plain-English guide to how Indian trading income is actually taxed.' },
        ],
    },

    {
        slug: 'circuit-filters',
        title: 'Circuit filters: when the market stops trading you',
        track: 'india-equity',
        level: 'intermediate',
        kind: 'study',
        minutes: 7,
        outcome: 'Explain why an order can become unfillable at exactly the moment you most want out.',
        where: { href: '/orders', label: 'Look at your orders' },
        visual: {
            kind: 'gauge',
            caption: "A circuit is not a pause. Trading continues \u2014 but only at that price, and only if somebody is on the other side.",
            value: 0.95,
            a: "lower circuit",
            b: "upper circuit",
            unit: "%",
        },
        prereq: ['intraday-vs-delivery'],
        concept: [
            'Indian exchanges cap how far a stock may move in a day. Depending on the security, the band is 2%, 5%, 10% or 20% either side of the previous close. Touch the upper limit and it is in **upper circuit**; touch the lower and it is in **lower circuit**.',
            'The trap is that a circuit is not a pause — trading continues, but only at that price. In an upper circuit there are buyers and effectively no sellers, so a buy order simply never fills. In a lower circuit the reverse: you want out, and there is nobody to sell to.',
            'This is the mechanism that turns a paper loss into a trapped one. A stock can be lower-circuited for several consecutive days, and your position falls the full amount each day while you are unable to act. No stop-loss helps, because a stop becomes a market order and a market order needs a counterparty.',
            'Index-level circuit breakers are separate and halt the whole market: a 10%, 15% or 20% move in the Nifty or Sensex stops trading for a period that depends on the size of the move and the time of day.',
            'The practical lesson is about position size in small and illiquid stocks. The stocks most likely to circuit are exactly the ones where a large position cannot be exited, and the two risks multiply rather than add.',
        ],
        inApp: 'This simulator does **not** model circuit filters — it will always fill you. That is a real limitation, and it means paper trading small caps here is easier than the real thing.',
        quiz: [
            {
                question: 'A stock you own is in lower circuit. Your stop-loss triggers. What happens?',
                options: ['It fills at your stop price', 'It fills at the circuit price', 'It probably does not fill at all — there are no buyers', 'The exchange fills it for you'],
                answer: 2,
                why: 'A stop becomes a market order, and a market order needs someone on the other side. In a lower circuit there is no bid. This is why stops are not a substitute for sizing a position you could survive being stuck in.',
            },
            {
                question: 'Why are circuit filters most dangerous in small caps?',
                options: ['Their bands are wider', 'They are the stocks where a position is already hardest to exit, so the two risks multiply', 'They circuit less often', 'They are not — large caps are worse'],
                answer: 1,
                why: 'Thin liquidity and narrow circuit bands go together. The stock that gaps to a lower circuit is usually the one you could not have sold in size anyway.',
            },
        ],
    },

    {
        slug: 'india-taxation',
        title: 'What you actually keep',
        track: 'india-equity',
        level: 'expert',
        kind: 'study',
        minutes: 10,
        outcome: 'Understand the STRUCTURE of Indian trading tax, and know where to check the current rates.',
        where: { href: '/funds', label: 'Review your charges' },
        visual: {
            kind: 'flow',
            caption: "Which box your profit falls into is decided before you trade, by the product you chose.",
            steps: [
                { label: "intraday equity", note: "speculative business income", tone: 'warn' },
                { label: "delivery equity", note: "capital gains, by holding period" },
                { label: "F&O", note: "non-speculative business income", tone: 'accent' },
                { label: "slab or special rate", note: "and different set-off rules", tone: 'down' },
            ],
        },
        prereq: ['intraday-vs-delivery'],
        concept: [
            'Indian trading income falls into categories that are taxed completely differently, and picking the wrong mental model costs more than most trading mistakes.',
            '**Delivery equity** is capital gains. Held twelve months or less it is short-term; longer, long-term. The two rates differ, and long-term gains have an annual exemption below which nothing is payable.',
            '**Intraday equity** is *speculative* business income, taxed at your slab rate. **Futures and options** are *non-speculative* business income — also slab-rate, but treated differently again for set-off and for whether an audit is required.',
            'Those distinctions decide what you can offset against what. Speculative losses can only be set off against speculative gains. Non-speculative business losses are more flexible. Capital losses have their own rules and carry-forward periods. Getting this right is worth real money to an active trader, and it is not something to work out in March.',
            '**The rates themselves change with almost every budget.** The 2024 budget altered both the short-term and long-term equity rates and the long-term exemption threshold. For that reason this lesson deliberately teaches the structure and does not quote current numbers as fact — check the source below, or ask a chartered accountant, and treat any figure older than the last budget as wrong.',
            'One number that is worth internalising regardless: **STT is charged on turnover, not on profit.** You pay it on every losing trade too. Traders who calculate their edge before costs and then trade frequently are the ones most surprised by their own year-end statement.',
            'This is education, not tax advice. An active F&O book in particular has audit implications that are worth an accountant.',
        ],
        inApp: '[Funds](/funds) itemises the charges this simulator models — brokerage, STT, stamp duty, exchange fees, SEBI turnover fee and GST — so you can see the shape of the cost, even though the tax on your profit is outside the app.',
        quiz: [
            {
                question: 'Why does this lesson refuse to quote current tax rates?',
                options: ['They are secret', 'They change with almost every budget, and a stale rate stated confidently is worse than none', 'They vary by broker', 'They only apply to companies'],
                answer: 1,
                why: 'The 2024 budget changed both the equity capital-gains rates and the long-term exemption. Teaching the structure lasts; quoting a number that quietly goes out of date does not.',
            },
            {
                question: 'STT is charged on…',
                options: ['Your profit', 'Your turnover, whether you win or lose', 'Your account balance', 'Only profitable trades'],
                answer: 1,
                why: 'It is a transaction tax. Every trade pays it, including every losing one — which is why turnover, not just win rate, decides what an active trader keeps.',
            },
        ],
        resources: [
            { kind: 'article', title: 'Varsity: Markets and Taxation', by: 'Zerodha', url: 'https://zerodha.com/varsity/module/markets-and-taxation/', why: 'Kept current, worked examples, and explains the set-off rules properly.' },
            { kind: 'regulator', title: 'SEBI Investor Website', url: 'https://investor.sebi.gov.in/', why: 'Official investor education, including the regulator\'s own research on retail outcomes.' },
        ],
    },
];
