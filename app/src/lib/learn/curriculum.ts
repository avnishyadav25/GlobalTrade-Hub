import * as v from './verify';
import { deriveFxRates, equity, estimateCharges, toBase } from '@/lib/paperEngine';
import type { Lesson, TrackId, VerifyContext } from './types';
import { INDIA_EQUITY_LESSONS } from './tracks/indiaEquity';
import { CRYPTO_LESSONS } from './tracks/crypto';
import { AIRDROP_LESSONS } from './tracks/airdrops';
import { IPO_LESSONS } from './tracks/ipo';

// The course. Sixteen lessons across five modules.
//
// Two rules hold everything together:
//   1. Every exercise is verified from PERSISTED ENGINE STATE. There is no "mark as
//      done" button anywhere, so the curriculum and your actual ledger cannot drift.
//   2. Every formula is rendered with YOUR numbers substituted in. "Order value is
//      quantity times price" is forgettable; seeing your own ₹12,450 is not.
//
// Slugs are stable — reordering into modules must not lose anyone's progress.

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function eq(c: VerifyContext) {
    return equity(c.state, c.quotes, deriveFxRates(c.quotes));
}

/** The most recent fill, for worked examples that need a real trade. */
function lastFill(c: VerifyContext) {
    return c.state.fills[0] ?? null;
}

const CORE_LESSONS: Lesson[] = [
    /* ============================================================ FOUNDATIONS */
    {
        slug: 'what-you-are-looking-at',
        title: 'What you are looking at',
        track: 'markets',
        level: 'foundation',
        kind: 'practice',
        minutes: 5,
        outcome: 'Name every part of the trading screen and say what it is for.',
        where: { href: '/terminal', label: 'Open the Terminal' },
        concept: [
            'An **instrument** is anything you can buy or sell: a share in a company (`RELIANCE`), a currency pair (`EUR/USD`), a cryptocurrency (`BTC/USDT`), a commodity (`XAU/USD` — gold), or an index (`NIFTY 50`).',
            'Instruments live in **markets**. This app covers five: India (NSE/BSE), US equities, crypto, foreign exchange, and commodities. They differ in opening hours, currency, and how fast prices move.',
            'The Terminal has three panes. On the left, your **watchlist** — the instruments you follow. In the middle, the **chart** and, below it, your positions and orders. On the right, the **order ticket**, where you actually buy and sell.',
            'Everything here is **paper trading**: the prices are real, the mechanics are real, the money is not. That is the safest possible place to be wrong, and you will be wrong often at first.',
        ],
        inApp: 'The [Terminal](/terminal) is the main screen. [Watchlists](/watchlists) is where you decide which instruments appear in that left rail.',
        exercise: {
            title: 'Look around',
            body: 'Open at least three different instruments from at least two different markets. Click a row in the watchlist to load it.',
            verify: v.viewedInstruments(3, 2),
        },
        drills: [
            {
                id: 'explore-8',
                title: 'Visit eight instruments',
                body: 'Click through eight different instruments and notice how differently each one moves. Crypto is not gold is not an Indian bank.',
                target: 8,
                count: v.countInstrumentsObserved,
            },
        ],
        quiz: [
            {
                question: 'What does "paper trading" mean?',
                options: ['Trading with real money in small size', 'Simulated trades with real prices and no real money', 'Trading only paper company shares', 'A practice mode where prices are fake'],
                answer: 1,
                why: 'The prices, fees, slippage and mechanics are real. Only the money is simulated — which is precisely what makes it useful.',
            },
        ],
        resources: [
            {
                kind: 'article',
                title: 'Varsity: Introduction to Stock Markets',
                by: 'Zerodha',
                url: 'https://zerodha.com/varsity/module/introduction-to-stock-markets/',
                why: 'Free, thorough, and written for the Indian market you are actually trading. Start at chapter 1.',
            },
            {
                kind: 'video',
                title: 'Zerodha (YouTube)',
                url: 'https://www.youtube.com/@ZerodhaOnline',
                why: 'Short explainers on NSE/BSE mechanics from the people who run the brokerage.',
            },
        ],
    },

    {
        slug: 'price-and-change',
        title: 'Price, change, and the 24-hour range',
        track: 'markets',
        level: 'foundation',
        kind: 'practice',
        minutes: 6,
        outcome: 'Read a price row and know exactly what each number is measured against.',
        where: { href: '/terminal', label: 'Compare two instruments' },
        prereq: ['what-you-are-looking-at'],
        concept: [
            'The **price** is what the instrument last traded at. It is a fact about the past, not a promise about the next second.',
            '**Change** and **% change** are measured against the **previous close** — where the instrument finished the last session. That is why a stock can be "down 2%" while rising all morning: it opened well below yesterday\'s close.',
            'The **24-hour high and low** show the range the price has travelled recently. A wide range means a volatile instrument; a narrow one means a quiet one. The same 1% move means very different things in each.',
            'Indian prices here are **delayed 15–20 minutes**. That is the honest limit of free market data without a broker account. It is fine for learning and completely unsuitable for reacting to news.',
        ],
        inApp: 'The header above the chart shows PREV, 24H H and 24H L. The [Watchlists](/watchlists) screen marks anything stale or queued rather than showing you an old number as if it were current.',
        formulas: [
            {
                label: 'Percentage change',
                expr: '% change = (price − previous close) ÷ previous close × 100',
                terms: [
                    { sym: 'price', meaning: 'the last traded price' },
                    { sym: 'previous close', meaning: 'where it finished the last session' },
                ],
                worked: (c) => {
                    const q = Object.values(c.quotes).find((x) => x.real && x.prevClose > 0);
                    if (!q) return null;
                    return `${q.symbol}: (${q.price.toFixed(2)} − ${q.prevClose.toFixed(2)}) ÷ ${q.prevClose.toFixed(2)} × 100 = ${q.changePercent.toFixed(2)}%`;
                },
            },
        ],
        exercise: {
            title: 'Find a riser and a faller',
            body: 'Open instruments until you have seen one that is up on the day and one that is down. Markets are never uniformly green or red.',
            verify: v.sawUpAndDown,
        },
        quiz: [
            {
                question: 'An instrument shows −1.5% but has risen every hour today. How?',
                options: ['The data is wrong', 'It opened well below yesterday’s close', '% change is measured over 24 hours', 'It must be a short position'],
                answer: 1,
                why: '% change compares to the previous close. A large gap down at the open can outweigh a whole day of gains.',
            },
        ],
        resources: [
            {
                kind: 'video',
                title: 'The Plain Bagel (YouTube)',
                url: 'https://www.youtube.com/@ThePlainBagel',
                why: 'Calm, jargon-free explanations of market basics with no hype and nothing to sell you.',
            },
        ],
    },

    {
        slug: 'currency-and-fx',
        title: 'Currency: why your dollars become rupees',
        track: 'markets',
        level: 'intermediate',
        kind: 'practice',
        minutes: 7,
        outcome: 'Explain what currency an instrument is priced in, and how it reaches your rupee balance.',
        where: { href: '/terminal', label: 'Trade something in dollars' },
        prereq: ['price-and-change'],
        visual: 'fx-conversion',
        concept: [
            'Your account is kept in **rupees**. But `AAPL` is priced in dollars and `USD/JPY` is priced in yen, so every non-rupee position has to be converted before it can appear in your balance.',
            'For a pair written `BASE/QUOTE`, the price is **how many units of QUOTE buy one BASE**, and quantity is measured in BASE. So `USD/JPY` at 158.88 means one dollar costs 158.88 **yen** — and the value of that position is in yen, not dollars.',
            'Getting this wrong is not a rounding error. Treating `USD/JPY` as dollar-denominated overstates it by a factor of about 159.',
            'The app converts at the **fill-time** rate and freezes it into your cost basis. That is deliberate: it separates the money you made on the instrument from the money you made because the rupee moved.',
            'The USD/INR rate is fetched live. When it cannot be, the app says so rather than quietly falling back to a constant — an out-of-date rate would misprice your entire book.',
        ],
        inApp: 'The order ticket shows the order value converted into rupees. [Funds](/funds) shows the whole book in rupees, and the reconciliation check there proves the conversions add up.',
        formulas: [
            {
                label: 'Converting a position into your base currency',
                expr: 'value in ₹ = quantity × price × (rate of quote currency to ₹)',
                terms: [
                    { sym: 'quantity', meaning: 'units of the BASE instrument' },
                    { sym: 'price', meaning: 'quoted in the QUOTE currency' },
                    { sym: 'rate', meaning: 'e.g. USD→INR ≈ 95.3' },
                ],
                worked: (c) => {
                    const fx = deriveFxRates(c.quotes);
                    const q = c.quotes['AAPL'] ?? Object.values(c.quotes).find((x) => x.real && x.symbol !== 'USD/INR');
                    if (!q) return null;
                    const base = toBase(q.symbol, q.price, fx);
                    return `1 × ${q.symbol} at ${q.price.toFixed(2)} = ${inr(base)}`;
                },
            },
        ],
        exercise: {
            title: 'Hold something foreign',
            body: 'Trade an instrument that is not priced in rupees — a US share, a crypto pair, or an FX pair. Then look at how it appears in your rupee balance.',
            verify: v.tradedForeignCurrency,
        },
        drills: [
            {
                id: 'three-markets',
                title: 'Trade in three different markets',
                body: 'Place a trade in three of the five markets. Notice that the same ₹10,000 buys wildly different amounts of exposure.',
                target: 3,
                count: v.countMarketsTraded,
            },
        ],
        quiz: [
            {
                question: '`USD/JPY` trades at 158.88. What is one unit worth?',
                options: ['158.88 US dollars', '158.88 Japanese yen', '158.88 rupees', 'One dollar and 88 cents'],
                answer: 1,
                why: 'In BASE/QUOTE, the price is in the QUOTE currency. USD/JPY is quoted in yen — so the position is valued in yen, then converted to rupees.',
            },
        ],
        resources: [
            {
                kind: 'article',
                title: 'Varsity: Currency, Commodity and Government Securities',
                by: 'Zerodha',
                url: 'https://zerodha.com/varsity/',
                why: 'Covers how currency pairs are quoted and settled in the Indian context.',
            },
        ],
    },

    /* ========================================================= PLACING ORDERS */
    {
        slug: 'your-first-order',
        title: 'Your first paper order',
        track: 'markets',
        level: 'foundation',
        kind: 'practice',
        minutes: 8,
        outcome: 'Place a market order and understand exactly what you committed to.',
        where: { href: '/terminal', label: 'Place an order' },
        prereq: ['what-you-are-looking-at'],
        visual: 'order-types',
        concept: [
            'To **buy** is to take a position that profits if the price rises. Traders call this being **long**.',
            'A **market order** says: fill me now, at whatever the market will give. You are certain to get filled; you are not certain of the price.',
            'The order ticket asks for three things: which side (buy or sell), what type (market, limit, stop), and how much (quantity). Everything else follows from those.',
            'When your order fills, the app records a **fill** — the actual quantity and price you got. One order can produce several fills at different prices.',
            'Start small. The purpose of your first trade is not profit; it is to see the machinery work end to end.',
        ],
        inApp: 'The order ticket sits on the right of the [Terminal](/terminal). Once filled, the position appears below the chart and the order appears on [Orders](/orders).',
        exercise: {
            title: 'Buy something',
            body: 'Place a market BUY. Any instrument, any size — small is better. Then find the resulting fill in the Positions panel.',
            verify: v.placedFirstBuy,
        },
        quiz: [
            {
                question: 'What does a market order guarantee?',
                options: ['The price you saw', 'That it will fill, but not at what price', 'Both price and execution', 'Neither'],
                answer: 1,
                why: 'Market orders trade certainty of price for certainty of execution. Limit orders make the opposite trade.',
            },
        ],
        resources: [
            {
                kind: 'video',
                title: 'Rayner Teo (YouTube)',
                url: 'https://www.youtube.com/@Rayner',
                why: 'Practical, beginner-friendly walkthroughs of order types and trade mechanics.',
            },
        ],
    },

    {
        slug: 'quantity-and-buying-power',
        title: 'Quantity, order value and buying power',
        track: 'markets',
        level: 'foundation',
        kind: 'practice',
        minutes: 7,
        outcome: 'Decide a position size deliberately instead of typing a round number.',
        where: { href: '/terminal', label: 'Size a trade' },
        prereq: ['your-first-order'],
        concept: [
            '**Order value** is simply quantity × price. It is what the position is worth, not what it can cost you.',
            '**Buying power** is what you can actually spend: your cash, minus anything resting orders have already reserved.',
            'Shares trade in whole units; crypto, FX and commodities are **fractional**, so you can buy 0.01 BTC. The app knows which is which and will refuse a fractional share order.',
            'The single most common beginner mistake is size. A position worth half your account does not need to be wrong often to end you. Something in the region of a few percent of equity per position leaves room to be wrong repeatedly and still be in the game.',
        ],
        inApp: 'The ticket shows Order value and Buying power side by side before you submit. [Portfolio](/portfolio) shows what fraction of your equity each position represents.',
        formulas: [
            {
                label: 'Order value',
                expr: 'order value = quantity × price',
                terms: [
                    { sym: 'quantity', meaning: 'units you are buying or selling' },
                    { sym: 'price', meaning: 'price per unit, in the quote currency' },
                ],
                worked: (c) => {
                    const f = lastFill(c);
                    if (!f) return null;
                    const fx = deriveFxRates(c.quotes);
                    return `${f.qty} × ${f.price.toFixed(2)} ${f.symbol} = ${inr(toBase(f.symbol, f.qty * f.price, fx))}`;
                },
            },
            {
                label: 'Position as a share of your account',
                expr: 'weight = position value ÷ equity',
                terms: [
                    { sym: 'equity', meaning: 'cash plus the market value of everything you hold' },
                ],
                worked: (c) => {
                    const e = eq(c);
                    const f = lastFill(c);
                    if (!f || e <= 0) return null;
                    const fx = deriveFxRates(c.quotes);
                    const pct = (toBase(f.symbol, f.qty * f.price, fx) / e) * 100;
                    return `Your last trade was ${pct.toFixed(1)}% of ${inr(e)} equity`;
                },
            },
        ],
        exercise: {
            title: 'Size a trade on purpose',
            body: 'Place a trade worth between 2% and 5% of your equity. Work the quantity out from your equity first, rather than picking a round number and seeing what happens.',
            verify: v.sizedBetween(0.02, 0.05),
        },
        quiz: [
            {
                question: 'Your equity is ₹5,00,000. What is a 3% position worth?',
                options: ['₹1,500', '₹15,000', '₹1,50,000', '₹50,000'],
                answer: 1,
                why: '3% of ₹5,00,000 is ₹15,000. If that feels too small to be interesting, that instinct is the one to argue with.',
            },
        ],
    },

    {
        slug: 'limit-orders',
        title: 'Limit orders: naming your price',
        track: 'markets',
        level: 'intermediate',
        kind: 'practice',
        minutes: 8,
        outcome: 'Use a limit order to control your price, and know when it will cost you the trade.',
        where: { href: '/terminal', label: 'Place a limit order' },
        prereq: ['your-first-order'],
        visual: 'order-types',
        concept: [
            'A **limit order** names the worst price you will accept. A buy limit at ₹1,300 says: buy at ₹1,300 or better, and wait if you have to.',
            'It sits on the order book as a **resting order** until the price reaches it. It may never fill. That is the trade you are making: certainty of price in exchange for uncertainty of execution.',
            'A limit order that fills against someone else\'s market order **adds** liquidity — you were there first. A market order **takes** it. On real exchanges makers often pay lower fees for exactly that reason.',
            'The failure mode to understand: you set a buy limit ₹5 below the market to save ₹5, the price runs away, and you miss a ₹500 move. Limit orders are for patience, not for shaving pennies.',
        ],
        inApp: 'Choose LIMIT on the ticket and a price field appears. Resting orders show on [Orders](/orders) under Open, and reserve part of your buying power until they fill or are cancelled.',
        exercise: {
            title: 'Rest an order on the book',
            body: 'Place a buy limit clearly below the current price — 0.5% or more — and confirm it sits in Orders → Open rather than filling.',
            verify: v.restedALimitOrder,
        },
        drills: [
            {
                id: 'cancel-3-limits',
                title: 'Place and cancel three limit orders',
                body: 'Rest three limit orders far from the market, then cancel them. Watch your buying power fall when they rest and recover when you cancel.',
                target: 3,
                count: v.countCancelledLimits,
            },
        ],
        quiz: [
            {
                question: 'Your buy limit is at ₹1,300 and the market is ₹1,340. What happens?',
                options: ['It fills immediately at ₹1,340', 'It fills immediately at ₹1,300', 'It rests until the price falls to ₹1,300', 'It is rejected'],
                answer: 2,
                why: 'A buy limit below the market waits. If the price never falls that far, it never fills.',
            },
        ],
        resources: [
            {
                kind: 'article',
                title: 'Varsity: Trading Systems',
                by: 'Zerodha',
                url: 'https://zerodha.com/varsity/module/trading-systems/',
                why: 'Goes deeper on order types, execution and how the book actually works.',
            },
        ],
    },

    {
        slug: 'fees-and-slippage',
        title: 'Fees and slippage: why your fill is not the price you saw',
        track: 'markets',
        level: 'intermediate',
        kind: 'practice',
        minutes: 7,
        outcome: 'Account for costs before you trade, not after.',
        where: { href: '/funds', label: 'Check your charges' },
        prereq: ['your-first-order'],
        visual: 'slippage-fees',
        concept: [
            'You clicked at ₹1,327.30. You filled at ₹1,327.95. The difference is **slippage** — the gap between the price you saw and the price you got.',
            'It happens because a market order crosses the **spread** (the gap between the best buy and the best sell) and, if it is large, eats through several price levels.',
            'On top of that come **charges**: brokerage, exchange fees, and taxes. In India these include STT, stamp duty and GST. They are small individually and substantial in aggregate.',
            'Both are simulated here. That is the point — a paper account that ignores costs teaches you a strategy that stops working the moment it meets a real broker.',
            'The arithmetic that matters: a strategy earning 0.3% per trade with 0.2% of round-trip costs keeps a third of what it appears to make. Trade it ten times a day and the costs, not the market, decide your year.',
        ],
        inApp: '[Funds](/funds) shows total charges paid and the full ledger. The ticket estimates charges before you submit.',
        formulas: [
            {
                label: 'Slippage',
                expr: 'slippage % = (fill price − quoted price) ÷ quoted price × 100',
                terms: [
                    { sym: 'fill price', meaning: 'what you actually got' },
                    { sym: 'quoted price', meaning: 'what was on screen when you clicked' },
                ],
            },
            {
                label: 'Charges on a trade',
                expr: 'charges = order value × (brokerage + exchange fees + taxes)',
                terms: [{ sym: 'order value', meaning: 'quantity × price' }],
                worked: (c) => {
                    const f = lastFill(c);
                    if (!f) return null;
                    const est = estimateCharges(f.symbol, f.qty, f.price, deriveFxRates(c.quotes));
                    return `${f.symbol}: order value ${inr(est.orderValue)} → charges ${inr(est.charges)} (${((est.charges / Math.max(est.orderValue, 1)) * 100).toFixed(3)}%)`;
                },
            },
        ],
        exercise: {
            title: 'Find what you have paid',
            body: 'Place any trade, then go to Funds and find the total charges. Compare your fill price to the price shown when you clicked.',
            verify: v.paidFees,
        },
        quiz: [
            {
                question: 'A strategy makes 0.3% per trade. Round-trip costs are 0.2%. What do you keep?',
                options: ['0.3%', '0.25%', '0.1%', '0.5%'],
                answer: 2,
                why: 'One third of the edge survives. This is why high-frequency strategies are far harder than they look on a chart.',
            },
        ],
        resources: [
            {
                kind: 'article',
                title: 'Varsity: Markets and Taxation',
                by: 'Zerodha',
                url: 'https://zerodha.com/varsity/module/markets-and-taxation/',
                why: 'The definitive plain-English guide to STT, stamp duty, GST and how Indian trading gains are taxed.',
            },
            {
                kind: 'article',
                title: 'Slippage (finance)',
                url: 'https://en.wikipedia.org/wiki/Slippage_(finance)',
                why: 'Short, neutral reference on why fills differ from quotes.',
            },
        ],
    },

    /* ========================================================== MANAGING RISK */
    {
        slug: 'closing-a-trade',
        title: 'Closing a trade: realised vs unrealised',
        track: 'markets',
        level: 'foundation',
        kind: 'practice',
        minutes: 7,
        outcome: 'Know the difference between profit on screen and profit in your account.',
        where: { href: '/holdings', label: 'Close a position' },
        prereq: ['your-first-order'],
        concept: [
            'While a position is open, its profit is **unrealised**. It changes with every tick and it is not yours. It is an opinion the market currently holds about your position.',
            'When you close, the profit becomes **realised** — locked in, added to your cash, and permanent.',
            'You close a long by selling the same quantity you bought. Sell less and you **reduce**; sell more and you **flip** to a short.',
            'A completed buy-then-sell cycle is a **round trip**. It is the unit of measurement for whether you can trade, because only closed trades have a definite answer.',
            'The hard part is not mechanical. Unrealised gains feel like money you already have, and unrealised losses feel like something that has not happened yet. Neither feeling is accurate.',
        ],
        inApp: '[Holdings](/holdings) shows unrealised P&L per position. [Funds](/funds) shows realised P&L, and the ledger shows exactly when each amount landed.',
        formulas: [
            {
                label: 'Unrealised profit on a long',
                expr: 'unrealised = (current price − average entry) × quantity',
                terms: [
                    { sym: 'average entry', meaning: 'the weighted average of every fill that built the position' },
                ],
                worked: (c) => {
                    const p = Object.values(c.state.positions).find((x) => x.qty > 0);
                    if (!p) return null;
                    const price = c.quotes[p.symbol]?.price ?? p.avgPrice;
                    const fx = deriveFxRates(c.quotes);
                    return `${p.symbol}: (${price.toFixed(2)} − ${p.avgPrice.toFixed(2)}) × ${p.qty} = ${inr(toBase(p.symbol, (price - p.avgPrice) * p.qty, fx))}`;
                },
            },
        ],
        exercise: {
            title: 'Complete a round trip',
            body: 'Close a position completely. Watch the profit move from unrealised to realised, and find the change in your cash on Funds.',
            verify: v.closedARoundTrip,
        },
        drills: [
            {
                id: 'five-round-trips',
                title: 'Complete five round trips',
                body: 'Open and fully close five positions. Do not aim for profit — aim for five clean, deliberate entries and exits.',
                target: 5,
                count: v.countRoundTrips,
            },
        ],
        quiz: [
            {
                question: 'Your position shows +₹8,000 unrealised. How much has your cash increased?',
                options: ['₹8,000', 'Nothing until you close it', '₹8,000 minus fees', 'Half of it'],
                answer: 1,
                why: 'Unrealised profit is a valuation, not a transaction. Cash moves only when the position closes.',
            },
        ],
    },

    {
        slug: 'stops',
        title: 'Stops: deciding the loss in advance',
        track: 'risk',
        level: 'foundation',
        kind: 'practice',
        minutes: 8,
        outcome: 'Place a stop that caps your loss at an amount you chose while calm.',
        where: { href: '/terminal', label: 'Protect a position' },
        prereq: ['closing-a-trade'],
        visual: 'order-types',
        concept: [
            'A **stop order** does nothing until the price reaches your trigger. Then it becomes a market order and exits you.',
            'For a long, the stop goes **below** your entry. For a short, **above**. It is always on the opposite side of the position from your profit.',
            'The reason to place it immediately, before the position moves, is that you will not think clearly later. Deciding your maximum loss while you have no money at stake is a completely different mental act from deciding it while losing.',
            'A stop is not a guarantee. In a fast move the price can gap straight through it and you exit worse than your trigger. It bounds your loss in normal conditions, not in every condition.',
            'Placing a stop too tight is its own mistake: you get stopped out by ordinary noise, repeatedly, and pay costs each time. The stop belongs where your reason for the trade would be proven wrong — not at a round number.',
        ],
        inApp: 'Choose SL on the ticket. Stops rest on [Orders](/orders) until triggered. [Alerts](/alerts) can also warn you at a level without placing an order.',
        exercise: {
            title: 'Protect a position',
            body: 'Open a position, then place a stop on the other side of it — a sell-stop under a long. Confirm it rests in Orders → Open.',
            verify: v.hasStopProtection,
        },
        drills: [
            {
                id: 'stops-5',
                title: 'Place five stops',
                body: 'Get into the habit: every position gets a stop, placed in the same minute you open it.',
                target: 5,
                count: v.countStopsPlaced,
            },
            {
                id: 'take-a-loss',
                title: 'Take three deliberate small losses',
                body: 'Let three stops actually trigger. Taking a planned small loss is a skill, and it is much easier to practise here than with real money.',
                target: 3,
                count: v.countLosingTradesClosed,
            },
        ],
        quiz: [
            {
                question: 'Why place a stop immediately rather than deciding later?',
                options: ['It fills faster', 'Stops are cheaper when placed early', 'You think more clearly before you have money at risk', 'It is required by the exchange'],
                answer: 2,
                why: 'The decision is the same; your ability to make it is not. Losing changes how you reason.',
            },
        ],
        resources: [
            {
                kind: 'article',
                title: 'Varsity: Risk Management and Trading Psychology',
                by: 'Zerodha',
                url: 'https://zerodha.com/varsity/module/risk-management/',
                why: 'The module most beginners skip and most professionals rate highest.',
            },
        ],
    },

    {
        slug: 'position-sizing',
        title: 'Position sizing: the only free lunch',
        track: 'risk',
        level: 'intermediate',
        kind: 'practice',
        minutes: 9,
        outcome: 'Compute a position size from the loss you are willing to take, not from the cash you happen to have.',
        where: { href: '/terminal', label: 'Size from your stop' },
        prereq: ['stops'],
        visual: 'risk-sizing',
        concept: [
            'Beginners size by asking "how much can I afford to buy?". Professionals size by asking "how much am I willing to lose if I am wrong?" — and let that decide the quantity.',
            'Fix your **risk per trade** first: a fraction of equity, commonly 0.5% to 2%. Then place your stop where the idea is disproven. The distance between entry and stop, divided into your risk budget, gives you the quantity.',
            'This decouples size from conviction. A trade with a tight stop gets a big position; one needing a wide stop gets a small one. Both risk the same rupees.',
            'The **R-multiple** follows naturally: express every outcome in units of the amount you risked. A win of 3R means you made three times what you were risking. This makes trades comparable across instruments and account sizes.',
            'Why this is the free lunch: you cannot control whether you are right, but you can control the size of being wrong — completely, and in advance.',
        ],
        inApp: 'Work the quantity out before you open the ticket. [Portfolio](/portfolio) shows each position as a share of equity; [Insights](/insights) can enforce a maximum position size as a hard rule.',
        formulas: [
            {
                label: 'Position size from risk',
                expr: 'quantity = (risk % × equity) ÷ |entry − stop|',
                terms: [
                    { sym: 'risk %', meaning: 'fraction of equity you accept losing, e.g. 0.01 for 1%' },
                    { sym: 'equity', meaning: 'cash plus market value of holdings' },
                    { sym: '|entry − stop|', meaning: 'the loss per unit if the stop triggers' },
                ],
                worked: (c) => {
                    const e = eq(c);
                    if (e <= 0) return null;
                    const risk = e * 0.01;
                    return `1% of ${inr(e)} = ${inr(risk)}. With a ₹20 stop distance that is ${Math.floor(risk / 20)} units.`;
                },
            },
            {
                label: 'R-multiple',
                expr: 'R = (exit − entry) ÷ |entry − stop|',
                terms: [{ sym: 'R', meaning: 'the result expressed in units of what you risked' }],
            },
            {
                label: 'Expectancy',
                expr: 'expectancy = (win rate × average win) − (loss rate × average loss)',
                terms: [
                    { sym: 'win rate', meaning: 'share of trades that were profitable' },
                    { sym: 'average win/loss', meaning: 'mean size of each, in R' },
                ],
                worked: (c) => {
                    const closed = c.state.fills.filter((f) => f.kind === 'close' || f.kind === 'reduce');
                    if (closed.length < 2) return null;
                    const wins = closed.filter((f) => f.pnl > 0);
                    const losses = closed.filter((f) => f.pnl < 0);
                    const avg = (xs: typeof closed) => (xs.length ? xs.reduce((t, f) => t + Math.abs(f.pnl), 0) / xs.length : 0);
                    const wr = wins.length / closed.length;
                    return `Your ${closed.length} closes: ${(wr * 100).toFixed(0)}% wins, average win ${inr(avg(wins))}, average loss ${inr(avg(losses))}`;
                },
            },
        ],
        exercise: {
            title: 'Risk exactly 1%',
            body: 'Open a position with a stop, sized so that (entry − stop) × quantity is no more than 1% of your equity. Compute the quantity before you place the order.',
            verify: v.riskedAtMost(0.01),
        },
        quiz: [
            {
                question: 'Equity ₹5,00,000, risk 1%, stop ₹25 below a ₹1,000 entry. How many units?',
                options: ['50', '200', '500', '5,000'],
                answer: 1,
                why: '1% of ₹5,00,000 is ₹5,000. Divided by a ₹25 loss per unit, that is 200 units — an order value of ₹2,00,000, which is 40% of the account but risks only 1%.',
            },
        ],
        resources: [
            {
                kind: 'book',
                title: 'Trade Your Way to Financial Freedom',
                by: 'Van K. Tharp',
                why: 'The book that made position sizing and R-multiples mainstream. Dry, but the core idea is worth the price alone.',
            },
            {
                kind: 'article',
                title: 'Kelly criterion',
                url: 'https://en.wikipedia.org/wiki/Kelly_criterion',
                why: 'The mathematical ceiling on bet sizing. Most traders use a small fraction of it — full Kelly is far too volatile to live with.',
            },
        ],
    },

    {
        slug: 'shorting-and-margin',
        title: 'Shorting and margin',
        track: 'risk',
        level: 'advanced',
        kind: 'practice',
        minutes: 8,
        outcome: 'Explain how a short makes money, and why it is the riskier side.',
        where: { href: '/holdings', label: 'Open a short' },
        prereq: ['closing-a-trade'],
        visual: 'long-vs-short',
        concept: [
            'To **short** is to sell something you do not own, planning to buy it back cheaper. You profit when the price falls.',
            'Because you have not paid for it, the broker holds **margin** — collateral against the position. That money is still yours but not available to trade with.',
            'The asymmetry is the point. A long can lose at most what you put in: a share can only fall to zero. A short has **no ceiling**, because a price can keep rising indefinitely.',
            'That asymmetry compounds badly. As a short moves against you the position gets *larger*, consuming more margin exactly when you can least afford it. A losing long shrinks; a losing short grows.',
            'Shorts are a legitimate tool. They are simply not the place to learn, and never the place to trade without a stop.',
        ],
        inApp: '[Holdings](/holdings) separates longs from shorts and shows margin held. [Funds](/funds) shows how much of your account that margin has locked up.',
        formulas: [
            {
                label: 'Profit on a short',
                expr: 'profit = (entry price − current price) × quantity',
                terms: [{ sym: 'quantity', meaning: 'units shorted (held as a negative position)' }],
            },
            {
                label: 'Margin held',
                expr: 'margin = |quantity| × entry price × margin rate',
                terms: [{ sym: 'margin rate', meaning: 'fraction of notional the broker reserves' }],
                worked: (c) => {
                    const s = Object.values(c.state.positions).find((p) => p.qty < 0);
                    return s ? `${s.symbol}: ${inr(s.marginHeldBase)} of your account is held as margin` : null;
                },
            },
        ],
        exercise: {
            title: 'Open a short',
            body: 'Sell an instrument you do not own. Watch the margin appear on Funds, then close it. Keep it small.',
            verify: v.openedAShort,
        },
        drills: [
            {
                id: 'shorts-3',
                title: 'Open and close three shorts',
                body: 'Get comfortable with the direction being inverted — green candles now hurt.',
                target: 3,
                count: v.countShortsOpened,
            },
        ],
        quiz: [
            {
                question: 'What is the maximum loss on a short?',
                options: ['The amount invested', 'Twice the amount invested', 'Unlimited in principle', 'The margin held'],
                answer: 2,
                why: 'A price has no upper bound, so neither does the loss. This is the single most important difference from a long.',
            },
        ],
        resources: [
            {
                kind: 'article',
                title: 'Short (finance)',
                url: 'https://en.wikipedia.org/wiki/Short_(finance)',
                why: 'Neutral reference covering mechanics, margin calls and short squeezes.',
            },
        ],
    },

    /* ====================================================== READING THE MARKET */
    {
        slug: 'reading-a-candle',
        title: 'Reading a candlestick',
        track: 'technical',
        level: 'foundation',
        kind: 'practice',
        minutes: 9,
        outcome: 'Read a candle correctly, and treat patterns with the scepticism they deserve.',
        where: { href: '/terminal', label: 'Study the chart' },
        prereq: ['price-and-change'],
        visual: 'candle-anatomy',
        concept: [
            'Each candle summarises one period of trading with four numbers: **open**, **high**, **low**, **close**. The body spans open to close; the thin **wicks** reach the high and low.',
            'A candle closing above its open is conventionally hollow or green; below, filled or red. Change the timeframe and each candle covers a different span — the same price action looks calm on a daily chart and frantic on a 1-minute one.',
            'The **wick** is the most informative part. A long lower wick means price fell and buyers pushed it back up within the period — the sellers tried and failed.',
            'Named patterns — **doji** (open ≈ close, indecision), **hammer** (long lower wick after a fall), **engulfing** (one body swallowing the previous) — are shorthand for those stories.',
            'Now the honest part: **patterns are weak evidence**. They are widely known, easily found by accident, and their published success rates rarely survive careful testing. Use them to describe what happened, and treat any pattern-based prediction as a hypothesis to be tested on the [Backtest](/backtest) screen, not a signal to act on.',
        ],
        inApp: 'The [Terminal](/terminal) chart draws real candles wherever a provider covers the instrument. Where none does, the series is generated and clearly labelled — never read patterns into a synthetic chart.',
        exercise: {
            title: 'Study five charts',
            body: 'Open five different instruments and look at their candles. Find one with a long wick and work out what happened during that period.',
            verify: v.studiedCharts(5),
        },
        quiz: [
            {
                question: 'A candle has a long lower wick and closes near its high. What happened?',
                options: ['Price rose steadily all period', 'Price fell, then buyers pushed it back up', 'Nothing traded', 'Price gapped down at the close'],
                answer: 1,
                why: 'The lower wick marks how far price fell; closing near the high means it recovered. Sellers pushed and did not hold it.',
            },
        ],
        resources: [
            {
                kind: 'book',
                title: 'Japanese Candlestick Charting Techniques',
                by: 'Steve Nison',
                why: 'The book that brought candlesticks to Western markets. Comprehensive on what each pattern means — read it alongside the scepticism above.',
            },
            {
                kind: 'article',
                title: 'Candlestick chart',
                url: 'https://en.wikipedia.org/wiki/Candlestick_chart',
                why: 'A quick neutral reference for the anatomy and the common pattern names.',
            },
            {
                kind: 'article',
                title: 'Varsity: Technical Analysis',
                by: 'Zerodha',
                url: 'https://zerodha.com/varsity/module/technical-analysis/',
                why: 'Free and detailed on candlesticks and chart patterns, with Indian market examples.',
            },
        ],
    },

    {
        slug: 'scanner-and-rsi',
        title: 'Scanners and RSI: finding candidates',
        track: 'technical',
        level: 'intermediate',
        kind: 'practice',
        minutes: 8,
        outcome: 'Use an indicator as a filter without mistaking it for a forecast.',
        where: { href: '/scanner', label: 'Run a scan' },
        prereq: ['reading-a-candle'],
        visual: 'rsi-gauge',
        concept: [
            'You cannot watch every instrument. A **scanner** applies filters across the whole universe and returns the handful worth a look.',
            '**RSI** — the Relative Strength Index — compares the size of recent gains to recent losses over a lookback period, and expresses it from 0 to 100. Below 30 is conventionally called oversold, above 70 overbought.',
            'The trap: "oversold" does not mean "about to rise". In a strong downtrend RSI can sit below 30 for weeks while the price keeps falling. Buying every oversold reading is a reliable way to catch every falling knife.',
            'RSI here is computed from prices this app has actually observed — not from a generator. That means it needs a **warm-up period** after you open the app, and instruments still warming up are excluded rather than guessed at. An indicator quietly defaulting to 50 would be worse than no indicator.',
            'Treat a scan as a way to narrow where you look. It never tells you the trade is good.',
        ],
        inApp: '[Scanner](/scanner) applies the filters and shows warm-up status. [Alerts](/alerts) can watch an RSI threshold for you instead.',
        formulas: [
            {
                label: 'Relative Strength Index',
                expr: 'RSI = 100 − 100 ÷ (1 + average gain ÷ average loss)',
                terms: [
                    { sym: 'average gain', meaning: 'mean size of up moves over the lookback' },
                    { sym: 'average loss', meaning: 'mean size of down moves over the lookback' },
                ],
                worked: (c) => {
                    const ready = Object.keys(c.quotes).filter((s) => c.rsi(s) != null);
                    if (!ready.length) return 'Still warming up — no instrument has enough observed history yet.';
                    return ready.slice(0, 4).map((s) => `${s} ${c.rsi(s)!.toFixed(1)}`).join(' · ');
                },
            },
        ],
        exercise: {
            title: 'Wait for the indicator',
            body: 'Leave the app open until RSI has warmed up on at least three instruments, then run a scan and look at what it returns.',
            verify: v.rsiWarmedUp(3),
        },
        quiz: [
            {
                question: 'RSI has been below 30 for three weeks while the price keeps falling. What does that tell you?',
                options: ['A reversal is overdue', 'The indicator is broken', 'The downtrend is strong — oversold is not a buy signal', 'You should buy more'],
                answer: 2,
                why: 'RSI measures momentum, not fair value. A persistent low reading describes a strong downtrend; it does not predict its end.',
            },
        ],
        resources: [
            {
                kind: 'article',
                title: 'Relative strength index',
                url: 'https://en.wikipedia.org/wiki/Relative_strength_index',
                why: 'The exact formula, including Wilder’s smoothing, and the standard criticisms.',
            },
            {
                kind: 'book',
                title: 'Technical Analysis of the Financial Markets',
                by: 'John J. Murphy',
                why: 'The standard reference for indicators. Encyclopaedic — use it to look things up rather than to read cover to cover.',
            },
        ],
    },

    /* ================================================ TRADING LIKE A PROFESSIONAL */
    {
        slug: 'journal-and-discipline',
        title: 'The journal: measuring your process',
        track: 'risk',
        level: 'intermediate',
        kind: 'practice',
        minutes: 8,
        outcome: 'Judge your trading by how you decided, not by whether it worked.',
        where: { href: '/insights', label: 'See your patterns' },
        prereq: ['closing-a-trade'],
        visual: 'equity-drawdown',
        concept: [
            'A good decision can lose money and a terrible one can make it. Over a handful of trades, outcome tells you almost nothing about skill.',
            'So measure the **process**: did you size the position deliberately? Did you place the stop before you needed it? Did you exit for the reason you planned, or because you could not stand watching?',
            'The recurring failures have names. **Revenge trading** — going straight back in bigger after a loss. **Oversizing** — the position that makes you check the screen at 2am. **Cutting winners early and holding losers** — the most common and most expensive pattern in retail trading.',
            'The **discipline score** here is computed from your actual fills, not from self-assessment. It can be low while you are profitable, and that is the useful signal: it means the market has been paying you for habits that will eventually take it back.',
            '**Drawdown** — the fall from your equity peak — is the number that decides whether you can keep going. A 50% drawdown needs a 100% gain just to get back to even.',
        ],
        inApp: '[Insights](/insights) computes the discipline score from your fills and suggests rules. [Portfolio](/portfolio) shows the equity curve those decisions produced.',
        formulas: [
            {
                label: 'Maximum drawdown',
                expr: 'drawdown = (peak equity − trough equity) ÷ peak equity',
                terms: [{ sym: 'peak', meaning: 'the highest equity reached before the fall' }],
            },
            {
                label: 'Recovery required',
                expr: 'gain needed = 1 ÷ (1 − drawdown) − 1',
                terms: [{ sym: 'drawdown', meaning: 'as a fraction, e.g. 0.5 for 50%' }],
                worked: () => 'A 20% drawdown needs +25%. A 50% drawdown needs +100%. An 80% drawdown needs +400%.',
            },
        ],
        exercise: {
            title: 'Build a track record',
            body: 'Complete ten round trips, then read your discipline score. Ten is the minimum at which the patterns mean anything.',
            verify: v.builtATrackRecord(10),
        },
        quiz: [
            {
                question: 'You are down 50% from your peak. What gain returns you to even?',
                options: ['50%', '75%', '100%', '150%'],
                answer: 2,
                why: 'Losses and gains are asymmetric. ₹100 falling 50% is ₹50; getting back to ₹100 from ₹50 is a 100% gain. This is why avoiding deep drawdowns matters more than catching big winners.',
            },
        ],
        resources: [
            {
                kind: 'book',
                title: 'Trading in the Zone',
                by: 'Mark Douglas',
                why: 'On why you already know what to do and do not do it. The single most recommended book on trading psychology.',
            },
            {
                kind: 'book',
                title: 'Market Wizards',
                by: 'Jack D. Schwager',
                url: 'https://en.wikipedia.org/wiki/Market_Wizards',
                why: 'Interviews with traders whose methods completely contradict each other — and who all agree about risk control.',
            },
        ],
    },

    {
        slug: 'rules-that-bind',
        title: 'Rules that actually bind you',
        track: 'risk',
        level: 'advanced',
        kind: 'practice',
        minutes: 8,
        outcome: 'Convert an intention into a constraint that refuses to let you break it.',
        where: { href: '/insights', label: 'Apply a rule' },
        prereq: ['journal-and-discipline'],
        concept: [
            'Everyone intends to size properly and stop after a bad day. Intentions fail exactly when they matter, because that is when you are least able to keep them.',
            'A **rule** is different from an intention: it is enforced by something other than your willpower. In this app, applying a rule puts it in the order path, where it **rejects** trades that break it.',
            'Three are available: a **cooldown after a loss** (no re-entry for a set period), a **maximum position size** as a share of equity, and a **daily stop** after two losing trades.',
            'They apply to every path — your own clicks, the Agents screen, and the automatic trading loop. There is no route around them, which is the entire point.',
            'When a rule blocks you it appears on [Orders](/orders) under Rejected, with the reason. That record is worth more than the trade you did not take.',
        ],
        inApp: 'Apply rules on [Insights](/insights). Rejections are recorded on [Orders](/orders) — they are not just a toast that disappears.',
        exercise: {
            title: 'Get blocked on purpose',
            body: 'Apply a rule on Insights, then deliberately try to place an order that breaks it. Find the rejection and its reason on the Orders screen.',
            verify: v.wasBlockedByARule,
        },
        drills: [
            {
                id: 'blocked-twice',
                title: 'Be refused twice',
                body: 'Trip two different rules. Knowing what a block feels like before it happens in a real drawdown is the point.',
                target: 2,
                count: v.countRuleRejections,
            },
        ],
        quiz: [
            {
                question: 'What does an applied coach rule do to an order that breaks it?',
                options: ['Warns you but places it', 'Refuses the order and records why', 'Reduces the quantity', 'Nothing until you go live'],
                answer: 1,
                why: 'It rejects the order at the single chokepoint every path goes through, and the rejection is kept with its reason.',
            },
        ],
        resources: [
            {
                kind: 'book',
                title: 'The Disciplined Trader',
                by: 'Mark Douglas',
                why: 'The precursor to Trading in the Zone, focused on turning intentions into rules you can actually keep.',
            },
        ],
    },

    {
        slug: 'going-live-safely',
        title: 'Going live safely',
        track: 'risk',
        level: 'expert',
        kind: 'practice',
        minutes: 9,
        outcome: 'Know what changes when the money is real, and what you should have proved first.',
        where: { href: '/settings', label: 'Review connections' },
        prereq: ['journal-and-discipline', 'rules-that-bind'],
        concept: [
            'Paper trading gets the mechanics right and the psychology completely wrong. Nothing here can reproduce what it feels like to watch real money fall.',
            'Before risking anything real, you want a **track record you would show someone**: enough round trips to be more than luck, a drawdown you survived without changing your rules, and a discipline score you are not embarrassed by.',
            'Then start far smaller than feels worthwhile. Your first live position should be small enough that losing it entirely changes nothing. Its job is to teach you how you behave, not to make money.',
            'What actually changes: your fills are worse than simulated ones, especially in size. Fees are real. And your hands shake — you will hesitate on entries you took instantly on paper.',
            'In this app, live trading requires a connected broker **and** an explicit arm step, and broker credentials never reach your browser. The **kill switch** halts every order path at once and is deliberately fail-safe: if either your device or the server has it on, it is on.',
            'Two honest warnings. Indian prices here are delayed 15–20 minutes — never act on them live. And most people who trade actively lose money; SEBI\'s own studies of Indian derivatives traders put the loss-making share above 90%. Going live is a decision to make deliberately, not by drifting into it.',
        ],
        inApp: '[Settings](/settings) holds broker connections and the arm switch. [Agents](/agents) holds the kill switch. [Funds](/funds) is where your paper track record lives.',
        exercise: {
            title: 'Earn the right',
            body: 'Complete ten round trips on paper and review your discipline score before connecting anything real. This exercise is not a formality.',
            verify: v.builtATrackRecord(10),
        },
        quiz: [
            {
                question: 'What does paper trading fail to simulate?',
                options: ['Fees', 'Slippage', 'How you behave when real money is falling', 'Margin on shorts'],
                answer: 2,
                why: 'Fees, slippage and margin are all simulated here. The psychology is the part that cannot be, and it is the part that decides most outcomes.',
            },
        ],
        resources: [
            {
                kind: 'article',
                title: 'SEBI Investor Website',
                url: 'https://investor.sebi.gov.in/',
                why: 'The Indian regulator’s own investor education material, including its research on retail trading outcomes.',
            },
            {
                kind: 'book',
                title: 'A Random Walk Down Wall Street',
                by: 'Burton Malkiel',
                url: 'https://en.wikipedia.org/wiki/A_Random_Walk_Down_Wall_Street',
                why: 'The strongest argument against active trading, which is exactly why it is worth reading before you commit to it.',
            },
            {
                kind: 'video',
                title: 'Patrick Boyle (YouTube)',
                url: 'https://www.youtube.com/@PatrickBoyle',
                why: 'A former hedge fund manager, dryly sceptical about most retail trading claims. Good antidote to finance influencers.',
            },
        ],
    },
];

/**
 * The whole course.
 *
 * Order matters: a lesson's prerequisites must appear before it, and there is a test
 * that fails if they do not. New tracks are appended, never spliced into the middle —
 * the first ten slugs are load-bearing for existing progress.
 */
export const LESSONS: Lesson[] = [
    ...CORE_LESSONS,
    ...INDIA_EQUITY_LESSONS,
    ...CRYPTO_LESSONS,
    ...AIRDROP_LESSONS,
    ...IPO_LESSONS,
];

export const lessonBySlug = (slug: string) => LESSONS.find((l) => l.slug === slug);

/** Lessons grouped by track, for the /learn landing page. */
export function lessonsByTrack(): Map<TrackId, Lesson[]> {
    const groups = new Map<TrackId, Lesson[]>();
    for (const l of LESSONS) groups.set(l.track, [...(groups.get(l.track) ?? []), l]);
    return groups;
}

export function lessonsInTrack(track: TrackId): Lesson[] {
    return LESSONS.filter((l) => l.track === track);
}
