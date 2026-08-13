import type { Lesson } from '../types';

// Track: crypto.
//
// The market this app actually trades live — the Binance websocket feed is real, so
// BTC and ETH prices here are not simulated. That makes crypto the one asset class
// where the lessons and the terminal are describing the same thing.

export const CRYPTO_LESSONS: Lesson[] = [
    {
        slug: 'what-a-blockchain-settles',
        title: 'What a blockchain actually does',
        track: 'crypto',
        level: 'foundation',
        kind: 'study',
        minutes: 8,
        outcome: 'Say what problem a blockchain solves, and what it does not.',
        where: { href: '/terminal', label: 'Watch a live crypto price' },
        visual: {
            kind: 'flow',
            caption: "The problem it solved, and the property that follows. Both directions of it.",
            steps: [
                { label: "digital money", tone: 'accent' },
                { label: "could be copied", note: "double spending", tone: 'down' },
                { label: "consensus rule", note: "no trusted party needed", tone: 'up' },
                { label: "irreversible", note: "a feature and a hazard", tone: 'warn' },
            ],
        },
        concept: [
            'Strip away the vocabulary and a blockchain is a **shared ledger that nobody owns and everybody can verify**. It records who holds what, and it settles transfers without a bank in the middle deciding whether they happened.',
            'The genuinely hard problem it solved is **double spending**. A digital file can be copied perfectly, so digital money needs some way to guarantee that the same coin is not spent twice. Before Bitcoin, the answer was always a trusted central party keeping the authoritative record. A blockchain replaces that party with a consensus rule and an incentive to follow it.',
            'What follows from that is a specific and limited set of properties: transfers settle without permission, the ledger is auditable by anyone, and no single party can reverse a confirmed transaction or freeze a self-custodied balance.',
            'What does **not** follow is equally important, and it is where most of the losses happen. A blockchain does not make the asset valuable, does not make the project honest, does not protect you from signing a malicious transaction, and does not give you any recourse when you send funds to the wrong address. Irreversibility is a feature at the protocol level and a hazard at the human level. They are the same property.',
            'Most tokens are not blockchains. They are entries in a smart contract on someone else\'s chain — created at will, with the rules set by whoever wrote the contract.',
        ],
        inApp: 'Crypto prices on [Terminal](/terminal) come from a real Binance websocket feed. Unlike most instruments in this simulator, those numbers are live.',
        quiz: [
            {
                question: 'What problem does a blockchain solve that a database does not?',
                options: ['Speed', 'Storage cost', 'Agreeing on a ledger without a trusted central party — which is what makes double spending preventable', 'Encryption'],
                answer: 2,
                why: 'A database is faster and cheaper; what it needs is an owner everyone trusts. Removing that requirement is the whole innovation, and everything else is a consequence of it.',
            },
            {
                question: 'You send funds to the wrong address. What recourse do you have?',
                options: ['Contact the chain\'s support', 'Reverse it within 24 hours', 'None — irreversibility is the same property that makes settlement trustless', 'File with the exchange'],
                answer: 2,
                why: 'There is no authority to appeal to. The property that removes the bank is the property that removes the refund, and they cannot be separated.',
            },
        ],
    },

    {
        slug: 'custody-and-keys',
        title: 'Custody: not your keys, not your coins',
        track: 'crypto',
        level: 'foundation',
        kind: 'study',
        minutes: 8,
        outcome: 'Choose a custody model deliberately, and know what each one exposes you to.',
        where: { href: '/settings', label: 'See how this app handles secrets' },
        visual: {
            kind: 'nested',
            caption: "A balance is controlled by a key. Everything else is a decision about who holds it.",
            steps: [
                { label: "your coins", tone: 'accent' },
                { label: "a private key", note: "whoever has it can move them", tone: 'warn' },
                { label: "exchange, or you", note: "an IOU, or your own seed phrase", tone: 'down' },
            ],
        },
        prereq: ['what-a-blockchain-settles'],
        concept: [
            'A crypto balance is controlled by a **private key**. Whoever holds the key can move the funds. That is the entire security model, and everything else is a decision about who holds it.',
            '**Exchange custody** means the exchange holds the key and your balance is a database entry — an IOU. It is convenient, recoverable if you lose your password, and it puts you behind every other creditor if the exchange fails. That is not hypothetical: Mt. Gox, QuadrigaCX and FTX each ended with customers who believed they owned assets discovering they owned a claim.',
            '**Self-custody** means you hold the key, usually as a twelve or twenty-four word seed phrase from which every key is derived. Nobody can freeze your funds and nobody can help you. Lose the phrase and the funds are gone permanently; let someone see it and they are gone immediately.',
            '**Hardware wallets** keep the key on a device that never exposes it to your computer. Transactions are signed on the device and confirmed with a physical button press. Malware on your laptop can propose a transaction but cannot sign one — which defeats the most common attack.',
            'The honest recommendation is boring and it is a split: keep on an exchange only what you are actively trading, and self-custody the rest — on hardware if the amount would hurt to lose. Write the seed phrase on paper. Never photograph it, never type it into anything, never store it in a password manager or a cloud note. Anything that syncs is a place it can leak from.',
            'One rule worth memorising: **no legitimate service will ever ask for your seed phrase.** Not support, not a wallet, not a migration tool, not an airdrop claim. The request is the attack.',
        ],
        inApp: 'This app never touches keys or a wallet. Broker credentials on [Settings](/settings) go to Supabase Vault server-side and are never returned to the browser — but there is no crypto wallet here at all, so nothing here can be drained.',
        quiz: [
            {
                question: 'What do you own when you hold Bitcoin on an exchange?',
                options: ['The Bitcoin itself', 'A claim on the exchange — a database entry, backed by whatever it actually holds', 'A private key', 'A regulated deposit'],
                answer: 1,
                why: 'The exchange holds the key. You hold a claim. If it fails, you are a creditor — which is what customers of Mt. Gox, QuadrigaCX and FTX discovered.',
            },
            {
                question: 'A wallet support agent asks for your seed phrase to restore your account. What is happening?',
                options: ['Standard verification', 'It is a scam — no legitimate service ever needs your seed phrase', 'It is safe if the site has HTTPS', 'Only risky on mobile'],
                answer: 1,
                why: 'The seed phrase derives every key you own. Nothing legitimate needs it, so the request itself is conclusive evidence of an attack.',
            },
        ],
    },

    {
        slug: 'exchanges-and-liquidity',
        title: 'Where the price comes from',
        track: 'crypto',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Explain why the same coin has different prices in different places, and what a thin book costs you.',
        where: { href: '/terminal', label: 'Watch the live order flow' },
        visual: {
            kind: 'ladder',
            caption: "The quoted price applies to the top of the book. Everything below is what size actually costs.",
            steps: [
                { label: "$1.00", note: "5,000 available", tone: 'up', value: 5 },
                { label: "$0.98", note: "12,000", tone: 'warn', value: 12 },
                { label: "$0.94", note: "40,000", tone: 'down', value: 40 },
                { label: "your $50,000 sale", note: "fills across all three", tone: 'down', value: 50 },
            ],
        },
        prereq: ['custody-and-keys'],
        concept: [
            'Crypto has no central exchange and no consolidated tape. Every venue runs its own order book, so the "price of Bitcoin" is really the price on whichever exchange your data comes from. The prices track each other closely because arbitrageurs profit whenever they do not — but they are never identical, and in stress they diverge sharply.',
            'A **centralised exchange** runs an order book much like a stock exchange: bids, asks, and a spread between them. A **decentralised exchange** typically uses an automated market maker instead, where a formula prices trades against a pool of assets rather than matching two people.',
            'The number that matters more than the price is **depth**: how much you can trade before you move the market. A coin quoted at $1.00 with $5,000 of bids within 2% is not a coin you can sell $50,000 of at $1.00. The quoted price applies to the next small trade and to nothing else.',
            'This is where the two most common crypto losses come from, and neither is a bad price call. **Slippage** on entry into a thin book, and the discovery on exit that the price you were watching was never available in your size.',
            'India adds a further wrinkle: domestic exchanges often trade at a persistent premium or discount to global venues, because moving capital across the border to arbitrage it is slow and expensive. The gap is not free money; it is the cost of the friction that sustains it.',
        ],
        inApp: 'This app subscribes to Binance for crypto, so what you see is one venue\'s book — the same caveat this lesson describes. The simulator fills you at the quoted price without depth modelling, which makes large paper crypto trades easier here than in reality.',
        quiz: [
            {
                question: 'A token is quoted at $1.00. What does that price apply to?',
                options: ['Any size you want to trade', 'The next small trade, and nothing else — size depends on depth', 'Only buys', 'The daily average'],
                answer: 1,
                why: 'Quoted price is the top of the book. What you actually receive on size depends on how much is resting behind it, which is why depth matters more than the headline price.',
            },
            {
                question: 'Why does a persistent India-vs-global price gap exist?',
                options: ['Different Bitcoin', 'Exchange error', 'Capital controls and transfer friction make arbitraging it slow and costly', 'Regulation forbids arbitrage'],
                answer: 2,
                why: 'A gap that persists is measuring the cost of closing it. If it were free to arbitrage, it would already be gone.',
            },
        ],
    },

    {
        slug: 'stablecoins',
        title: 'Stablecoins, and the ways they have broken',
        track: 'crypto',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Distinguish the three stablecoin designs and know which one has failed catastrophically.',
        where: { href: '/terminal', label: 'Look at a USDT pair' },
        visual: {
            kind: 'stack',
            caption: "Three designs. They fail differently, and only one has failed completely at scale.",
            steps: [
                { label: "fiat-backed", note: "counterparty risk \u2014 reserves must be real", tone: 'warn' },
                { label: "crypto-collateralised", note: "over-collateralised, liquidation can lag" },
                { label: "algorithmic", note: "FAILED \u2014 Terra/UST, ~$40bn in days", tone: 'down' },
            ],
        },
        prereq: ['exchanges-and-liquidity'],
        concept: [
            'A stablecoin aims to hold a fixed value, almost always one US dollar. Most crypto trading is denominated in them — which means that if a stablecoin fails, it does not just lose value, it reprices every pair quoted against it.',
            'There are three designs, and they fail in different ways.',
            '**Fiat-backed**: a company holds dollars and short-term instruments and issues tokens against them. The risk is a **counterparty** risk — whether the reserves exist, are liquid, and are actually redeemable. It has wobbled: USDC briefly traded below a dollar in March 2023 when part of its reserves sat at a bank that failed over a weekend.',
            '**Crypto-collateralised**: the peg is held by over-collateralised loans on-chain, typically $150 or more of volatile collateral per $100 issued. Transparent and auditable, but the over-collateralisation is capital-inefficient, and a fast enough crash can outrun the liquidation machinery.',
            '**Algorithmic**: no meaningful collateral at all — the peg is maintained by a mint-and-burn mechanism against a second, freely issued token. This design has **failed completely**. Terra/UST collapsed in May 2022, destroying roughly $40bn in days, when the mechanism ran in reverse: falling confidence triggered redemptions, redemptions issued more of the paired token, its price collapsed, and the death spiral fed itself.',
            'The general principle worth carrying: **a stablecoin is only as stable as its worst redemption day.** A peg that has held for years tells you the mechanism has not yet met its stress case, not that it cannot.',
        ],
        inApp: 'Crypto pairs here are quoted against USDT, which the app converts to INR through the live USD/INR rate. A depeg would flow straight into your paper P&L — as it would in reality.',
        quiz: [
            {
                question: 'Which stablecoin design has already failed catastrophically at scale?',
                options: ['Fiat-backed', 'Crypto-collateralised', 'Algorithmic — Terra/UST, roughly $40bn in days', 'None have'],
                answer: 2,
                why: 'The mint-and-burn mechanism runs in reverse under stress: redemptions inflate the paired token, its collapse accelerates redemptions, and the spiral is self-reinforcing.',
            },
            {
                question: 'What is the main risk in a fiat-backed stablecoin?',
                options: ['Smart contract bugs', 'Counterparty risk — whether the reserves exist, are liquid and are redeemable', 'Mining difficulty', 'Network congestion'],
                answer: 1,
                why: 'It is a claim on a company. USDC traded below a dollar in March 2023 because part of its reserves sat at a bank that failed — a banking risk, not a crypto one.',
            },
        ],
    },

    {
        slug: 'perps-and-funding',
        title: 'Perpetual futures and the funding rate',
        track: 'crypto',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Explain how a futures contract with no expiry stays tied to spot, and read funding as positioning.',
        where: { href: '/strategies', label: 'See the funding-carry signal' },
        visual: {
            kind: 'gauge',
            caption: "Funding is not a survey. It is what crowded positioning actually costs, paid every eight hours.",
            value: 0.82,
            a: "shorts pay longs",
            b: "longs pay shorts",
            unit: "% crowded",
        },
        prereq: ['exchanges-and-liquidity'],
        concept: [
            'A **perpetual future** is a futures contract with no expiry date. Most crypto leverage trades through them, and their volume routinely exceeds spot.',
            'A normal future converges to spot because it expires — at expiry, contract and asset must be the same thing. A perpetual has no expiry, so it needs a different anchor. That anchor is the **funding rate**: a periodic payment, typically every eight hours, made directly between longs and shorts.',
            'The rule is simple and self-correcting. When the perpetual trades **above** spot, funding is positive and **longs pay shorts** — which makes being long expensive and pulls the price back down. When it trades below, shorts pay longs. The exchange takes no side; it is a transfer between traders.',
            'This makes funding one of the most honest sentiment indicators in any market, because it is not a survey — it is what positioning is actually costing. **Persistently high positive funding means the long side is crowded and paying for the privilege.** Those conditions precede long liquidation cascades, because a crowded, leveraged side is exactly what a sharp move liquidates.',
            'The corresponding trade — long spot, short the perpetual, collect funding — is a real strategy called **cash-and-carry** or funding carry. It is market-neutral in direction and is not risk-free: funding can flip negative, the two legs are on different venues with different margin, and a violent move can liquidate the short leg before profits on the spot leg can be realised.',
            'A word on leverage. Exchanges advertise 50× or 100×. At 100×, a **1% adverse move liquidates you** — and 1% moves happen in crypto within minutes, routinely. High advertised leverage is a product feature for the exchange, whose fee income scales with turnover; it is not a facility built for your benefit.',
        ],
        inApp: 'The **funding-rate carry** strategy is in the library and is marked **signal-only, not executable**. This paper engine has no perpetual-futures instrument, so the trade cannot actually be placed — and a button implying otherwise would be a lie about what is built.',
        formulas: [
            {
                label: 'Funding payment',
                expr: 'payment = position notional × funding rate',
                terms: [
                    { sym: 'sign', meaning: 'positive rate → longs pay shorts; negative → shorts pay longs' },
                ],
                worked: () => 'A $10,000 long at +0.01% per 8h pays $1 three times a day — about 11% annualised, before any price move.',
            },
        ],
        quiz: [
            {
                question: 'Funding is strongly positive. What does that tell you?',
                options: ['Shorts are paying longs', 'The perpetual trades above spot and longs are paying to hold — the long side is crowded', 'The exchange is charging a fee', 'The contract is near expiry'],
                answer: 1,
                why: 'Positive funding means perp above spot and longs paying shorts. It is a direct measure of what crowded positioning costs, and sustained highs often precede long liquidation cascades.',
            },
            {
                question: 'At 100× leverage, how far can price move against you before liquidation?',
                options: ['About 10%', 'About 1%', 'About 50%', 'There is no liquidation'],
                answer: 1,
                why: 'Roughly 1%, before fees and funding — a move crypto makes within minutes. High advertised leverage generates exchange fee income; it is not a facility built for the trader.',
            },
        ],
    },

    {
        slug: 'india-vda-tax',
        title: 'India\'s crypto tax regime, and why it changes strategy',
        track: 'crypto',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Understand the three features of the VDA regime that make frequent trading structurally expensive.',
        where: { href: '/funds', label: 'See your trading charges' },
        visual: {
            kind: 'waterfall',
            caption: "Ten winners and ten equal losers. Under equity rules this nets to nothing; under the VDA regime it does not.",
            steps: [
                { label: "gains", note: "\u20b95,00,000", tone: 'up', value: 500 },
                { label: "losses", note: "\u20b95,00,000 \u2014 NOT set off", tone: 'down', value: 500 },
                { label: "taxable", note: "the full gain", tone: 'down', value: 500 },
                { label: "economic result", note: "you broke even", tone: 'warn', value: 0 },
            ],
        },
        prereq: ['what-a-blockchain-settles'],
        concept: [
            'India taxes **virtual digital assets** under a regime distinct from equity, and three structural features matter far more than the headline rate.',
            '**A flat rate on gains, with no deductions.** Gains on VDA transfers are taxed at a flat rate. You may deduct the cost of acquisition and essentially nothing else — not exchange fees, not infrastructure, not interest.',
            '**No loss set-off, and no carry-forward.** This is the one that changes everything. A loss on one coin cannot be set against a gain on another, cannot be set against any other income, and cannot be carried into next year. Under equity rules, a year of ten winners and ten equal losers is roughly tax-neutral. Under the VDA regime it is not: **you pay on the gross gains and absorb the losses entirely.**',
            '**TDS at source on transfers.** A percentage is deducted on the transaction itself. It is creditable against your final liability rather than an extra tax — but it is withheld on every transfer, which for a frequent trader means a meaningful share of capital is continuously locked up awaiting a refund.',
            'Put those together and the arithmetic is stark for active trading. Every round trip is taxed on the way up and unrelieved on the way down, while TDS ties up working capital in proportion to turnover. **The regime is structurally hostile to high-frequency crypto trading** in a way the equity regime is not — a fact worth knowing before designing a strategy around it, rather than after.',
            '**Rates, thresholds and TDS percentages change with the budget, so this lesson deliberately quotes none of them.** The three structural features above have been the stable part. Verify current numbers against the official source, and use a chartered accountant if the amounts are meaningful. This is education, not tax advice.',
        ],
        inApp: '[Funds](/funds) models trading charges only — brokerage, exchange fees and so on. It does not model tax, and for Indian crypto that omission is large.',
        quiz: [
            {
                question: 'You make ₹5 lakh on one coin and lose ₹5 lakh on another in the same year. What is taxable?',
                options: ['Nothing — they net off', 'The full ₹5 lakh gain — VDA losses cannot be set off against gains', '₹2.5 lakh', 'Only if you withdraw to INR'],
                answer: 1,
                why: 'No set-off and no carry-forward is the defining feature of the regime. A portfolio that broke even can still produce a substantial bill, which is why it penalises frequent trading so heavily.',
            },
            {
                question: 'What is the practical effect of TDS on transfers for an active trader?',
                options: ['It is an extra tax on top', 'It is creditable against final liability, but it locks up working capital in proportion to turnover', 'It applies only above ₹10 lakh', 'It replaces the flat rate'],
                answer: 1,
                why: 'It is a withholding, not an additional levy — but the capital is unavailable until the refund. The higher your turnover, the larger the share of your book sitting idle.',
            },
        ],
        resources: [
            { kind: 'article', title: 'Varsity: Markets and Taxation', by: 'Zerodha', url: 'https://zerodha.com/varsity/module/markets-and-taxation/', why: 'Kept current across budget changes, with worked examples.' },
        ],
    },
];
