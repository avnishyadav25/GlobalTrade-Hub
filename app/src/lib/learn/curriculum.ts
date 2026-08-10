import type { Lesson } from './types';
import * as v from './verify';

// Written for someone who has never traded. Each lesson: what it is, where it lives in
// this app, one exercise checked against your real paper account, and a short quiz.

export const LESSONS: Lesson[] = [
    {
        slug: 'what-you-are-looking-at',
        title: 'What you are looking at',
        minutes: 5,
        outcome: 'Read the Terminal without guessing.',
        concept: [
            'An **instrument** is one thing you can buy or sell — a share in Reliance, a bitcoin, an ounce of gold. Each one lives in a **market**: India (NSE), US (NASDAQ), crypto, forex, commodities.',
            'The Terminal has three panes. Left: your **watchlist**, the instruments you follow. Middle: the **chart**, price over time. Right: the **order ticket**, where you buy and sell.',
            'Markets keep different hours. Indian shares trade 9:15–15:30 IST on weekdays; crypto never closes. Outside those hours the price simply stops moving.',
            'Prices here are **live for crypto and US shares**, and about **15 minutes delayed for Indian shares** — the badge in the header tells you which. That delay is fine for learning; it is not fine for real money.',
        ],
        inApp: 'Open the Terminal and click through a few rows in the left-hand watchlist. Notice the market tabs — All, Crypto, India, US, FX, Comm.',
        exercise: {
            title: 'Look at three instruments across two markets',
            body: 'Click at least three different rows in the watchlist, and make sure they are not all from the same market.',
            verify: v.viewedInstruments(3, 2),
        },
        quiz: [
            { question: 'What does the DELAYED badge in the header mean?', options: ['The app is slow', 'Some prices are older than real-time', 'The market is closed'], answer: 1, why: 'It reports the worst latency across your markets — usually the 15-minute Indian feed.' },
            { question: 'Which market never closes?', options: ['NSE', 'NASDAQ', 'Crypto'], answer: 2, why: 'Crypto trades 24/7, which is why its chart keeps moving at midnight.' },
        ],
    },
    {
        slug: 'price-and-change',
        title: 'Price, change, and the 24-hour range',
        minutes: 6,
        outcome: 'Say what "up 2%" is actually measured against.',
        concept: [
            '**LTP** (last traded price) is simply the price of the most recent trade. It is not an offer to you — it is a record of what someone else just paid.',
            'A percentage change always needs a **reference point**. Here it is the **previous close**: where the instrument finished the last session. "+2%" means 2% above that, not 2% above where it opened or where you bought.',
            'The **24h high and low** frame the day. A price near the high tells you buyers have been willing to pay up; near the low, the opposite. Neither predicts anything on its own.',
            'A number without its reference is meaningless. Always ask: percent of what, since when?',
        ],
        inApp: 'The Terminal header shows PREV, 24H H and 24H L next to the price. The Scanner sorts by % change.',
        exercise: {
            title: 'Find one riser and one faller',
            body: 'Look through your watchlist for an instrument that is up today and one that is down today.',
            verify: v.sawUpAndDown,
        },
        quiz: [
            { question: '"RELIANCE +1.5%" is measured against…', options: ['Its previous close', 'Your purchase price', "Today's open"], answer: 0, why: 'Previous close is the standard reference for a daily change.' },
            { question: 'If the price equals the 24h high, that means…', options: ['It must fall next', 'It is the highest traded in 24h', 'It is expensive'], answer: 1, why: 'It is a factual observation about the last 24 hours, not a prediction.' },
        ],
    },
    {
        slug: 'your-first-order',
        title: 'Your first paper order',
        minutes: 8,
        outcome: 'Place a trade and understand exactly what happened.',
        concept: [
            'A **market order** says "buy now, at whatever the going price is". It fills immediately. That certainty of *execution* costs you certainty of *price*.',
            'Everything here is **paper**: virtual money, real prices. You start with ₹5,00,000. You cannot lose anything real, which is exactly why you should practise the bad outcomes too.',
            'When your order fills you get a **fill** — a record of quantity, price and time. One order can produce several fills if it executes in pieces.',
            'You now hold a **position**: a quantity of something, with an average price. It shows on Holdings and in the Terminal panel below the chart.',
        ],
        inApp: 'Terminal → right-hand ticket → Buy → Market → Submit. Then look at Positions below the chart, and at Orders → Executed.',
        exercise: {
            title: 'Place one market buy',
            body: 'Any instrument, any size within your buying power. Watch the Positions tab change.',
            verify: v.placedFirstBuy,
        },
        quiz: [
            { question: 'A market order guarantees…', options: ['Your price', 'That it fills', 'A profit'], answer: 1, why: 'It trades certainty of price for certainty of execution.' },
            { question: 'What is a fill?', options: ['A record of an executed trade', 'A type of order', 'A fee'], answer: 0, why: 'Orders are instructions; fills are what actually happened.' },
        ],
    },
    {
        slug: 'quantity-and-buying-power',
        title: 'Quantity, order value and buying power',
        minutes: 7,
        outcome: 'Size a position on purpose instead of by accident.',
        concept: [
            '**Order value = quantity × price.** Ten shares at ₹1,300 is ₹13,000 of exposure. The quantity alone tells you nothing — a share of one company is not comparable to a share of another.',
            'Everything here is converted to **rupees**. A US share priced in dollars is worth its price × the USD/INR rate, which the app fetches live. That is why the same US position changes value in ₹ even when the dollar price is flat.',
            '**Buying power** is the cash you can actually commit right now: your cash minus anything already reserved by resting orders. The ticket shows it, and refuses orders that exceed it.',
            'Beginners almost always trade too big. A single position worth more than a few percent of your account means one bad day undoes weeks of good ones.',
        ],
        inApp: 'The order ticket shows Order value, Margin reqd, Charges and Buying power before you commit. Funds → Balance breaks the same numbers down.',
        exercise: {
            title: 'Place a trade worth 2–5% of your equity',
            body: 'Work out 2–5% of your equity, then set a quantity whose Order value lands in that band before you submit.',
            verify: v.sizedBetween(0.02, 0.05),
        },
        quiz: [
            { question: 'Buying power is…', options: ['Your total equity', 'Cash minus what is reserved', 'Your profit'], answer: 1, why: 'Resting orders reserve cash so you cannot spend it twice.' },
            { question: '20 shares at ₹500 is an exposure of…', options: ['₹520', '₹10,000', '₹500'], answer: 1, why: 'Quantity × price = order value.' },
        ],
    },
    {
        slug: 'closing-a-trade',
        title: 'Closing a trade: realised vs unrealised',
        minutes: 7,
        outcome: 'Know the difference between a paper gain and a banked one.',
        concept: [
            'While you hold a position its profit is **unrealised** — it moves every tick and it is not yours yet. The moment you close, it becomes **realised** and settles into cash.',
            'A **round trip** is one complete open-and-close. That, not the number of fills, is what a "trade" means when you count your win rate. A position closed in three pieces is still one round trip.',
            'Realised P&L is reported **gross of charges**, and charges are deducted from cash separately. Funds → Balance shows both, and the net figure is the one that matches your cash.',
            'Unrealised profit that you never close is not profit. Plenty of traders have watched a large gain become a loss because closing felt like admitting the run was over.',
        ],
        inApp: 'Holdings shows unrealised P&L per position. Funds → Balance shows realised. Paper shows your win rate over round trips.',
        exercise: {
            title: 'Close a position completely',
            body: 'Sell the whole quantity you bought. Watch the P&L move from unrealised to realised.',
            verify: v.closedARoundTrip,
        },
        quiz: [
            { question: 'Unrealised P&L is…', options: ['Already in your cash', 'Only on paper until you close', 'A fee'], answer: 1, why: 'It changes with every tick and is not settled.' },
            { question: 'A position closed in 3 partial fills counts as…', options: ['3 trades', '1 round trip', 'No trades'], answer: 1, why: 'Round trips count complete positions, which is why the win rate uses them.' },
        ],
    },
    {
        slug: 'limit-orders',
        title: 'Limit orders: naming your price',
        minutes: 8,
        outcome: 'Wait for your price instead of paying whatever is asked.',
        concept: [
            'A **limit order** says "buy, but pay no more than X". It goes on the order book and waits. You get certainty of *price*, giving up certainty of *execution* — it may never fill.',
            'A market order is a **taker**: it removes liquidity and pays the higher fee. A limit order that rests is a **maker**: it adds liquidity and pays less. This app charges the two differently, as real venues do.',
            'A resting buy order **reserves cash**. That is why your buying power drops the moment you place it, before anything has traded — the money is spoken for.',
            'If it never reaches your price, it never fills. That is the trade-off, not a malfunction.',
        ],
        inApp: 'Ticket → LIMIT → set a price → Submit. It appears in Orders → Open with the reserved amount shown, and you can cancel it there.',
        exercise: {
            title: 'Place a limit buy below the market',
            body: 'Set a limit at least 0.5% below the current price so it rests rather than filling instantly. Then find it in Orders → Open.',
            verify: v.restedALimitOrder,
        },
        quiz: [
            { question: 'A limit buy guarantees…', options: ['That it fills', 'You pay no more than your price', 'A profit'], answer: 1, why: 'Price certainty, at the cost of possibly never trading.' },
            { question: 'Why does buying power drop when you place a resting buy?', options: ['A fee is charged', 'Cash is reserved for it', 'It is a bug'], answer: 1, why: 'Reserving prevents you committing the same rupee twice.' },
        ],
    },
    {
        slug: 'stops',
        title: 'Stops: deciding the loss in advance',
        minutes: 8,
        outcome: 'Cap a loss before you are emotionally involved in it.',
        concept: [
            'A **stop order** triggers when the price reaches a level you set — typically to close a position that has gone against you. You choose the exit while you are calm, not while you are losing.',
            'For a long position the stop sits **below** your entry, on the sell side. For a short it sits **above**, on the buy side. Same side as the direction that hurts you.',
            'A stop is not a guarantee of price. Once triggered it becomes a market order, so in a fast move you can fill **worse** than your stop level. That is called slippage, and the backtester here models it.',
            'The real function of a stop is not the money — it is removing the in-the-moment decision, which is where most damage happens.',
        ],
        inApp: 'Ticket → SL → set a trigger price. It rests in Orders → Open until the market reaches it.',
        exercise: {
            title: 'Protect an open position with a stop',
            body: 'Hold a position, then place an SL on the opposite side — a sell-stop below a long.',
            verify: v.hasStopProtection,
        },
        quiz: [
            { question: 'A stop on a long position goes…', options: ['Above the price, buy side', 'Below the price, sell side', 'At the price'], answer: 1, why: 'It exits you as the price falls against you.' },
            { question: 'A stop guarantees your exit price.', options: ['True', 'False'], answer: 1, why: 'It becomes a market order when triggered, so it can slip.' },
        ],
    },
    {
        slug: 'fees-and-slippage',
        title: 'Fees and slippage: why your fill is not the price you saw',
        minutes: 7,
        outcome: 'Account for the cost of trading, which is invisible until you look.',
        concept: [
            '**Charges** are what the venue takes. They are small per trade and brutal in aggregate — trading ten times a day at a few basis points each will quietly outweigh most edges.',
            '**Slippage** is the gap between the price you saw and the price you got. Market orders here fill 3 basis points worse than the quote, which is a deliberately realistic penalty for demanding immediacy.',
            'Both are why a strategy that looks profitable on paper often is not. The backtester applies the same charges as the paper engine, so its results and your live results agree.',
            'Costs are the one part of trading you can control with certainty. Trading less is the most reliable way to pay less.',
        ],
        inApp: 'The ticket previews Charges before you submit. Funds → Balance totals what you have paid. Compare a fill price in Orders → Executed against the quote at the time.',
        exercise: {
            title: 'Find what you have paid',
            body: 'Place at least one trade, then read your total charges on Funds → Balance.',
            verify: v.paidFees,
        },
        quiz: [
            { question: 'Slippage is…', options: ['A fee', 'The gap between expected and actual fill price', 'A chart pattern'], answer: 1, why: 'It is the cost of demanding immediate execution.' },
            { question: 'Which order type usually pays the higher fee?', options: ['Market (taker)', 'Limit (maker)'], answer: 0, why: 'Takers remove liquidity, so venues charge them more.' },
        ],
    },
    {
        slug: 'shorting-and-margin',
        title: 'Shorting and margin',
        minutes: 8,
        outcome: 'Understand why a short is not just "a buy in reverse".',
        concept: [
            'Selling something you do not own opens a **short**. You profit if the price falls. It is not symmetrical with buying: a long can only lose what you put in, while a short’s loss has no ceiling, because the price can keep rising.',
            '**Margin** is cash the broker holds hostage while the short is open. This app holds 100% of the notional, so shorting does not create buying power out of thin air.',
            'On Funds you can see margin held separately from available cash. Closing the short releases it.',
            'Shorting is a legitimate tool and a common way for beginners to lose badly. Practise it here precisely because it costs nothing.',
        ],
        inApp: 'Ticket → Sell on an instrument you do not hold. Holdings lists shorts separately, with the margin held.',
        exercise: {
            title: 'Open a short and watch the margin',
            body: 'Sell something you do not own, then check the margin figure on Funds → Balance.',
            verify: v.openedAShort,
        },
        quiz: [
            { question: 'The maximum loss on a short is…', options: ['Your margin', 'Unlimited in principle', 'Your entry price'], answer: 1, why: 'Price can rise without bound, so the loss can exceed what you committed.' },
            { question: 'Margin held is…', options: ['A fee you pay', 'Your cash, reserved until you close', 'Profit'], answer: 1, why: 'You get it back when the short is covered.' },
        ],
    },
    {
        slug: 'rules-that-bind',
        title: 'Rules that actually bind you',
        minutes: 8,
        outcome: 'Pre-commit to discipline instead of relying on willpower.',
        concept: [
            'Most trading losses are behavioural, not analytical. **Revenge trading** — re-entering immediately after a loss to win it back — is the classic one, and it is measurable.',
            'This app can enforce rules at order time: a cooldown after a loss, a cap on position size, a daily two-loss stop. Applied rules **refuse the order**, they do not merely warn.',
            'A rule you can override in the moment is not a rule. The value is that it binds when you least want it to.',
            'A refused order is not a malfunction. It is the version of you that set the rule overruling the version placing the trade.',
        ],
        inApp: 'Insights → Suggested rule changes → Apply. Refused orders appear in Orders → Rejected with the exact reason.',
        exercise: {
            title: 'Get blocked on purpose',
            body: 'Apply a rule on Insights, then deliberately try to break it. Find the refusal in Orders → Rejected.',
            verify: v.wasBlockedByARule,
        },
        quiz: [
            { question: 'An applied coach rule…', options: ['Warns you', 'Refuses the order', 'Closes positions'], answer: 1, why: 'Enforcement happens inside the single order chokepoint, so every path obeys it.' },
            { question: 'Revenge trading is…', options: ['Trading after a loss to win it back', 'A strategy', 'A fee'], answer: 0, why: 'It is the most common and most expensive behavioural leak.' },
        ],
    },
];

export const lessonBySlug = (slug: string) => LESSONS.find((l) => l.slug === slug);
