import { deriveFxRates, equity, openOrders, reconciliationError, type PaperState } from '@/lib/paperEngine';
import { fmtMoney, fmtPct, fmtPrice } from '@/lib/format';
import type { VerifyContext } from './types';

// Per-screen contextual help — the "?" in each page header.
//
// The point of these is the `value` function on each card: it reports a number from
// YOUR account rather than describing the feature in the abstract. "Buying power is
// cash minus what open orders have reserved" teaches far less than seeing your own
// ₹4,79,349 next to the sentence.
//
// Naming note: `lib/coach.ts` and `useCoachStore` belong to the TRADING-RULES coach
// (the thing that blocks orders). Nothing here touches it. UI help lives entirely in
// the learn namespace and persists in `useLearnStore.seenCoachMarks`.

export interface CoachCard {
    title: string;
    /** Markdown-lite: **bold**, `code`, [links](/route), `- ` bullets. */
    body: string;
    /** A live figure from the user's own account. Null when not applicable yet. */
    value?: (ctx: VerifyContext) => string | null;
}

export interface CoachTopic {
    title: string;
    blurb: string;
    cards: CoachCard[];
    /** Slug of the lesson that covers this properly. */
    lesson?: string;
}

const money = (n: number) => fmtMoney(n, 'INR', 2);

function eq(ctx: VerifyContext): number {
    return equity(ctx.state, ctx.quotes, deriveFxRates(ctx.quotes));
}

function longsAndShorts(state: PaperState) {
    const all = Object.values(state.positions);
    return { longs: all.filter((p) => p.qty > 0), shorts: all.filter((p) => p.qty < 0) };
}

export const COACH_TOPICS: Record<string, CoachTopic> = {
    // ---------------------------------------------------------------- Terminal panes
    'terminal.watchlist': {
        title: 'The watchlist rail',
        blurb: 'Your instruments, and how to read a row at a glance.',
        lesson: 'what-you-are-looking-at',
        cards: [
            {
                title: 'What a row shows',
                body:
                    'The **symbol**, then today’s **price** and **% change** against the previous close. ' +
                    'Green means the price is above where it closed last session, red below. ' +
                    'The tabs filter by market — India, US, crypto, FX, commodities.',
            },
            {
                title: 'Why some rows say “—”',
                body:
                    'A dash means **no real price has arrived yet** for that instrument. It is deliberately blank ' +
                    'rather than showing the catalog’s placeholder number, which would be wrong by a wide margin. ' +
                    '“queued” means the poll deliberately skipped it this cycle to stay inside the free data budget; ' +
                    'it refreshes within a couple of minutes.',
            },
            {
                title: 'This list is yours',
                body: 'Add, remove and reorder on [Watchlists](/watchlists). Anything you add becomes tradeable here.',
                value: (ctx) => `${Object.keys(ctx.quotes).length} instruments currently priced`,
            },
        ],
    },

    'terminal.chart': {
        title: 'Reading the chart',
        blurb: 'Candles, timeframes, and what the data actually is.',
        lesson: 'reading-a-candle',
        cards: [
            {
                title: 'One candle = one time period',
                body:
                    'The **body** spans the open and close; the thin **wicks** reach the high and low. ' +
                    'A filled/red body means it closed below its open, hollow/green means it closed above. ' +
                    'Change the timeframe and each candle covers a different span — 15m, 1h, 1d.',
            },
            {
                title: 'Where this data comes from',
                body:
                    'Real history from Yahoo or Binance wherever a provider covers the instrument. ' +
                    'If none does, the chart is a **generated** series and says so — never trade off a labelled ' +
                    'synthetic chart.',
            },
            {
                title: 'Indian prices are delayed',
                body:
                    'NSE/BSE quotes here run **15–20 minutes behind**. That is the honest limit of free data without ' +
                    'a broker account. The badge in the header shows the lag per market.',
            },
        ],
    },

    'terminal.ticket': {
        title: 'Placing an order',
        blurb: 'Side, type, quantity — and what each one commits you to.',
        lesson: 'your-first-order',
        cards: [
            {
                title: 'Buy or sell, market or limit',
                body:
                    '**Market** fills immediately at whatever price is available — certain execution, uncertain price. ' +
                    '**Limit** names your worst acceptable price and waits — certain price, uncertain execution. ' +
                    'A **stop** does nothing until the price reaches your trigger, then becomes a market order.',
            },
            {
                title: 'Order value vs buying power',
                body:
                    'Order value is simply `quantity × price`, converted into rupees. You cannot spend more than ' +
                    'your buying power: cash, minus anything your resting orders have already reserved.',
                value: (ctx) => `Cash ${money(ctx.state.account.cash)} · equity ${money(eq(ctx))}`,
            },
            {
                title: 'Your fill will not be the price you saw',
                body:
                    'Market orders cross the spread and move the book slightly — that gap is **slippage**. ' +
                    'Brokerage and taxes come off on top. Both are simulated here, so paper results stay honest.',
                value: (ctx) =>
                    ctx.state.account.feesPaid > 0 ? `You have paid ${money(ctx.state.account.feesPaid)} in fees so far` : null,
            },
        ],
    },

    'terminal.positions': {
        title: 'Your open positions',
        blurb: 'What you hold right now, and what it is worth.',
        lesson: 'closing-a-trade',
        cards: [
            {
                title: 'Unrealised vs realised',
                body:
                    'While a position is open its profit is **unrealised** — it moves with every tick and is not yours yet. ' +
                    'Close it and the number becomes **realised**: locked in, added to your cash.',
                value: (ctx) => `Realised so far: ${money(ctx.state.account.realizedGross)}`,
            },
            {
                title: 'Average price',
                body:
                    'Buy the same instrument twice and your entry becomes the weighted average of both fills. ' +
                    'That average, not your first price, is what your profit is measured from.',
                value: (ctx) => {
                    const { longs, shorts } = longsAndShorts(ctx.state);
                    if (!longs.length && !shorts.length) return 'No open positions yet';
                    return `${longs.length} long · ${shorts.length} short`;
                },
            },
        ],
    },

    // ---------------------------------------------------------------------- Pages
    orders: {
        title: 'Orders',
        blurb: 'Every order you have placed, and why some never filled.',
        lesson: 'limit-orders',
        cards: [
            {
                title: 'Open, executed, rejected',
                body:
                    '**Open** orders are resting — waiting for the price to reach them. **Executed** have filled, ' +
                    'fully or partly. **Rejected** never reached the market, and each one keeps the reason why.',
                value: (ctx) => {
                    const rejected = ctx.state.orders.filter((o) => o.status === 'rejected').length;
                    return `${openOrders(ctx.state).length} open · ${ctx.state.orders.length} total · ${rejected} rejected`;
                },
            },
            {
                title: 'An order is not a fill',
                body:
                    'One order can produce several **fills** at different prices — expand a row to see them. ' +
                    'That is normal for larger quantities and is why your average fill price can differ from the ' +
                    'price you clicked.',
            },
            {
                title: 'Read your rejections',
                body:
                    'Rejections are the cheapest lessons available. Common causes: not enough buying power, ' +
                    'a quantity below the minimum, no price available for the instrument, or one of your own ' +
                    'coach rules refusing the trade.',
            },
        ],
    },

    holdings: {
        title: 'Holdings',
        blurb: 'Longs and shorts, split because they behave differently.',
        lesson: 'shorting-and-margin',
        cards: [
            {
                title: 'Why longs and shorts are separated',
                body:
                    'A **long** costs you cash and can lose at most what you put in. A **short** borrows the ' +
                    'instrument and holds **margin** against it — the loss is theoretically unbounded, because ' +
                    'a price can keep rising.',
                value: (ctx) => {
                    const { longs, shorts } = longsAndShorts(ctx.state);
                    return `${longs.length} long · ${shorts.length} short`;
                },
            },
            {
                title: 'Margin held',
                body:
                    'Shorts reserve part of your account as collateral. That money is not gone, but it is not ' +
                    'available to trade with either.',
                value: (ctx) => {
                    const held = Object.values(ctx.state.positions).reduce((t, p) => t + (p.marginHeldBase ?? 0), 0);
                    return held > 0 ? `${money(held)} currently held as margin` : 'No margin held right now';
                },
            },
        ],
    },

    portfolio: {
        title: 'Portfolio',
        blurb: 'The whole account in one view.',
        lesson: 'quantity-and-buying-power',
        cards: [
            {
                title: 'Equity is the honest number',
                body:
                    'Equity is your cash **plus** the current market value of everything you hold. It is the single ' +
                    'figure that tells you whether you are ahead. Cash alone does not — it ignores open positions.',
                value: (ctx) => {
                    const e = eq(ctx);
                    const start = ctx.state.account.startingCash;
                    return `${money(e)} · ${fmtPct(((e - start) / start) * 100)} from ${money(start)}`;
                },
            },
            {
                title: 'Concentration',
                body:
                    'The breakdown shows how much of your account sits in each market. A single instrument holding ' +
                    'most of your equity means one piece of news decides your month.',
            },
        ],
    },

    funds: {
        title: 'Funds & ledger',
        blurb: 'Where every rupee went.',
        lesson: 'fees-and-slippage',
        cards: [
            {
                title: 'Cash, reserved, margin, equity',
                body:
                    '**Cash** is settled and spendable. **Reserved** is earmarked by resting orders. ' +
                    '**Margin** backs your shorts. **Equity** is everything together at current prices.',
                value: (ctx) => `Cash ${money(ctx.state.account.cash)} · equity ${money(eq(ctx))}`,
            },
            {
                title: 'The ledger reconciles',
                body:
                    'Every row is rebuilt from your actual fills, and the running balance must land exactly on your ' +
                    'cash. If it did not, something in the accounting would be wrong — so this is a live proof, ' +
                    'not a summary.',
                value: (ctx) => {
                    const err = reconciliationError(ctx.state);
                    return Math.abs(err) < 0.01 ? 'Reconciles exactly ✓' : `Out by ${money(err)} — please report this`;
                },
            },
            {
                title: 'Fees are real money',
                body:
                    'Brokerage, exchange charges and taxes are simulated on every fill. Traders who ignore costs ' +
                    'and trade often are frequently profitable before fees and unprofitable after them.',
                value: (ctx) =>
                    ctx.state.account.feesPaid > 0
                        ? `${money(ctx.state.account.feesPaid)} paid across ${ctx.state.fills.length} fills`
                        : 'No fees yet — you have not traded',
            },
        ],
    },

    watchlist: {
        title: 'Watchlists',
        blurb: 'Build the set of instruments you actually follow.',
        lesson: 'what-you-are-looking-at',
        cards: [
            {
                title: 'Search covers five markets',
                body:
                    'NSE/BSE, US exchanges, crypto, FX and futures. If search is throttled, the exact ticker still ' +
                    'resolves — try `TATAMOTORS.NS`, `TSLA` or `BTC-USD`.',
            },
            {
                title: 'Anything you add is tradeable',
                body:
                    'A new instrument is registered with its real market and currency, so the engine prices it ' +
                    'correctly — an NSE stock in rupees, not dollars. It then appears on the Terminal and can be ' +
                    'charted and backtested.',
            },
            {
                title: 'Prices arrive in rotation',
                body:
                    'Free data has hard rate limits. Instruments you hold, have orders or alerts on, or are looking ' +
                    'at refresh every cycle; the rest rotate through. A row marked “queued” is waiting its turn, not broken.',
            },
        ],
    },

    alerts: {
        title: 'Alerts',
        blurb: 'Be told when something happens, instead of watching.',
        lesson: 'stops',
        cards: [
            {
                title: 'Four kinds of condition',
                body:
                    'Price crossing a level, a **% move** on the day, an **RSI** threshold, or a break of the ' +
                    '**24-hour range**. Each fires on the *crossing*, not continuously while the condition holds.',
                value: (ctx) => `${Object.keys(ctx.quotes).length} instruments currently being watched`,
            },
            {
                title: 'An alert is not an order',
                body:
                    'Alerts never place trades. When one fires you get a notification and a shortcut to the order ' +
                    'ticket — the decision stays yours. That is deliberate: automatic order paths bypass the checks ' +
                    'that protect you.',
            },
            {
                title: 'RSI needs warm-up',
                body:
                    'RSI cannot be computed until enough price history has been observed. Until then an RSI alert ' +
                    'simply will not fire — it is never treated as a neutral 50.',
            },
        ],
    },

    scanner: {
        title: 'Scanner',
        blurb: 'Filter the whole universe down to what matters now.',
        lesson: 'scanner-and-rsi',
        cards: [
            {
                title: 'What RSI measures',
                body:
                    'The Relative Strength Index compares recent gains to recent losses on a 0–100 scale. ' +
                    'Below 30 is conventionally “oversold”, above 70 “overbought”. Neither is a signal on its own — ' +
                    'strong trends stay overbought for weeks.',
            },
            {
                title: 'Computed from observed prices',
                body:
                    'RSI here is built from prices this app has actually seen, not a generator. That means it needs ' +
                    'a warm-up period after you open the app, and instruments still warming up are excluded rather ' +
                    'than guessed at.',
            },
            {
                title: 'A filter, not advice',
                body: 'A scan narrows where to look. It does not tell you the trade is good.',
            },
        ],
    },

    insights: {
        title: 'Trading coach',
        blurb: 'Patterns in how you trade — and rules that can bind you.',
        lesson: 'rules-that-bind',
        cards: [
            {
                title: 'Discipline score',
                body:
                    'Computed from your own fills: revenge trades, oversized positions, cutting winners early, ' +
                    'letting losers run. It measures **process**, not profit — you can make money badly.',
                value: (ctx) => `${ctx.state.account.roundTrips} completed round trips so far`,
            },
            {
                title: 'Applied rules actually refuse orders',
                body:
                    'This is the important part. Applying a rule here does not just advise you — it sits in the ' +
                    'order path and **rejects** trades that break it, on every route including the AI agents. ' +
                    'The rejection appears on [Orders](/orders) with its reason.',
            },
        ],
    },

    agents: {
        title: 'AI agents',
        blurb: 'Automation, and the guardrails around it.',
        lesson: 'rules-that-bind',
        cards: [
            {
                title: 'Guardrails apply to every path',
                body:
                    'Maximum order value, maximum open positions and daily loss limits are enforced identically ' +
                    'whether you press “Trade” yourself or the automatic loop acts. There is no path around them.',
            },
            {
                title: 'The kill switch',
                body:
                    'Halts **all** order placement immediately — manual, agent, paper and live. It is deliberately ' +
                    'fail-safe: if either your device or the server has it on, it is on.',
            },
            {
                title: 'Auto-live never substitutes',
                body:
                    'If a live order fails to route, the signal is skipped and you are told. It will not quietly ' +
                    'place a paper order instead — a simulated trade standing in for a real one would be a ' +
                    'dangerous surprise.',
            },
        ],
    },

    signals: {
        title: 'Strategy signals',
        blurb: 'What your strategies want to do, before anything is placed.',
        lesson: 'rules-that-bind',
        cards: [
            {
                title: 'Nothing is placed without approval',
                body:
                    'Every strategy ships in **review** mode: it posts what it wants to do here and waits. ' +
                    'Switching one to **auto** is a per-strategy decision you make after watching it, not a ' +
                    'global setting.',
            },
            {
                title: 'The price will have moved',
                body:
                    'A signal records the close of the bar that triggered it. By the time you read it the ' +
                    'market has moved on, so the card shows both prices and how far apart they are. ' +
                    'Orders are always sized from the **live** price, never the stale one.',
            },
            {
                title: 'Refusals are recorded',
                body:
                    'An order the kill switch or a coach rule refuses stays here with its reason, and also ' +
                    'appears on [Orders](/orders). A signal that vanished silently would be impossible to learn from.',
            },
        ],
    },

    settings: {
        title: 'Settings',
        blurb: 'Connections, keys and the live-trading switch.',
        cards: [
            {
                title: 'Broker credentials never reach your browser',
                body:
                    'Keys are stored server-side in an encrypted vault and used only by server routes. The browser ' +
                    'sees connection status and nothing else.',
            },
            {
                title: 'Paper and live are separate',
                body:
                    'A paper connection cannot place a real order and a live connection is never used for paper. ' +
                    'Live trading additionally has to be armed explicitly.',
            },
        ],
    },

    backtest: {
        title: 'Backtest',
        blurb: 'Testing a rule against history — and its limits.',
        cards: [
            {
                title: 'Only real data counts',
                body:
                    'Where a provider covers the instrument you get genuine historical bars. Where none does, the ' +
                    'series is **generated** and the result is labelled “not a historical backtest”. Treat that ' +
                    'label as disqualifying.',
            },
            {
                title: 'Why a good backtest still fails',
                body:
                    '- It ignores slippage on size\n' +
                    '- One instrument over one period is a small sample\n' +
                    '- Tuning parameters until the curve looks good fits the past, not the future',
            },
        ],
    },

    learn: {
        title: 'How Learn works',
        blurb: 'Exercises are checked against your real account.',
        cards: [
            {
                title: 'Nothing is marked done by hand',
                body:
                    'Every exercise is verified from your actual engine state — your fills, your orders, your ' +
                    'positions. There is no “mark complete” button, so your progress and your trading history ' +
                    'can never drift apart.',
                value: (ctx) => `${ctx.state.fills.length} fills · ${ctx.state.account.roundTrips} round trips on record`,
            },
            {
                title: 'Work in order, but not rigidly',
                body:
                    'Lessons build on each other and later ones suggest what to do first, but nothing is locked. ' +
                    'Jump to what you need.',
            },
        ],
    },

    paper: {
        title: 'Paper account',
        blurb: 'Simulated money, real mechanics.',
        cards: [
            {
                title: 'What is simulated and what is not',
                body:
                    'Prices, fees, slippage, margin and matching all behave like the real thing. The money does not ' +
                    'exist. That combination is exactly what makes it useful for learning.',
                value: (ctx) => `Started with ${money(ctx.state.account.startingCash)}, now ${money(eq(ctx))}`,
            },
            {
                title: 'Resetting',
                body:
                    'A reset wipes positions, orders and history back to the starting balance. Your lesson progress ' +
                    'stays, but exercises verified from trades you no longer have will show as incomplete again.',
            },
        ],
    },
};

export function coachTopic(key: string | undefined): CoachTopic | undefined {
    return key ? COACH_TOPICS[key] : undefined;
}

/** Every topic key, for the integrity test. */
export const COACH_TOPIC_KEYS = Object.keys(COACH_TOPICS);

export { fmtPrice };
