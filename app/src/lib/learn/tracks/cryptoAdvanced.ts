import type { Lesson } from '../types';

// Track: crypto (continuation). Appended after crypto.ts so prerequisites resolve.

export const CRYPTO_ADVANCED: Lesson[] = [
    {
        slug: 'layers-and-gas',
        title: 'Layers, gas, and why a transaction costs what it costs',
        track: 'crypto',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Explain what you are paying for when you send a transaction, and what a layer 2 changes.',
        where: { href: '/terminal', label: 'Back to the terminal' },
        prereq: ['exchanges-and-liquidity'],
        concept: [
            'Every transaction on a blockchain consumes computation, and **gas** is the unit that meters it. You pay gas price × gas used, and the gas price floats with demand — it is a continuous auction for scarce block space, not a fee schedule.',
            'This produces a property with no equivalent in traditional finance: **the cost of moving money is independent of how much money you move, and depends entirely on how busy the network is.** Sending $10 and $10 million can cost the same, and both can cost far more during congestion than they did an hour earlier.',
            'That is also the constraint that shapes the whole industry. A **layer 1** — Ethereum, Bitcoin, Solana — settles transactions itself and is limited by its own block space. The **blockchain trilemma** describes the trade-off: decentralisation, security and scalability, with designs generally sacrificing one to strengthen the others.',
            'A **layer 2** executes transactions off the main chain and periodically posts compressed proofs or data back to it, inheriting the layer 1\'s security while spreading its cost across many transactions. Fees fall substantially. **Rollups** are the dominant design.',
            'What this means practically. Fees are unpredictable and can dominate small transactions entirely. **Bridging** assets between chains is where a large share of the industry\'s biggest thefts have occurred, because bridges concentrate value in complex contracts. And **sending to an address on the wrong chain** is a common and usually unrecoverable way to lose funds — the address may look identical across chains and the assets do not arrive.',
        ],
        inApp: 'This app touches no chain and pays no gas — crypto here is price data from Binance, not on-chain activity. Nothing in this simulator can be bridged or sent anywhere.',
        quiz: [
            {
                question: 'What does a transaction fee depend on?',
                options: ['The amount sent', 'Network congestion and computation used — not the value transferred', 'The sender\'s balance', 'The exchange rate'],
                answer: 1,
                why: 'Gas meters computation and block space. Sending $10 and $10 million can cost the same, and both vary with how busy the network is.',
            },
            {
                question: 'Where have many of crypto\'s largest thefts occurred?',
                options: ['Hardware wallets', 'Cross-chain bridges, which concentrate value in complex contracts', 'Layer 1 consensus', 'Mining pools'],
                answer: 1,
                why: 'Bridges hold large balances in contracts that must be trusted across two chains. That combination has made them a recurring target.',
            },
        ],
    },

    {
        slug: 'amms-and-impermanent-loss',
        title: 'AMMs and impermanent loss',
        track: 'crypto',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Explain why providing liquidity can lose money while both assets rise.',
        where: { href: '/learn', label: 'Back to the track' },
        prereq: ['layers-and-gas'],
        concept: [
            'A decentralised exchange usually has no order book. Instead an **automated market maker** prices trades against a pool of two assets using a formula — classically `x × y = k`, where the product of the two reserves stays constant.',
            'The consequences fall straight out of the formula. Buying from the pool reduces one reserve and increases the other, which moves the price along a curve. Large trades move it further — that is slippage, determined mechanically rather than by counterparties. Anyone can supply assets to the pool as a **liquidity provider** and earn a share of trading fees.',
            '**Impermanent loss** is the cost of doing that, and the name is misleading enough to be dangerous. It is the difference between holding the two assets in the pool and simply holding them in your wallet. When their relative price diverges, the pool automatically sells the appreciating asset and buys the depreciating one — because that is what keeping the product constant requires.',
            'The result is the outcome that surprises providers: **both assets can rise and you can still end up worse off than if you had just held them.** You are not down in absolute terms; you are down against the passive alternative. And "impermanent" only means it reverses if the price ratio returns to where it started — which for a volatile pair, frequently never happens.',
            'So liquidity provision is a real trade with a real shape: **you collect fees and you are short volatility on the pair.** It is profitable when fees exceed divergence, which favours correlated pairs and high-volume pools, and it loses when one asset moves sharply.',
            'The version to avoid is the one most heavily marketed: **a high advertised yield on a pool containing a new, volatile token.** The yield is high precisely because the divergence risk is high, and it is frequently paid in the same token whose price the divergence is about.',
        ],
        inApp: 'No AMM, no liquidity pools and no on-chain interaction exist in this app. Included because "earning yield" is presented as passive income and it is a short-volatility position with a specific and computable risk.',
        formulas: [
            {
                label: 'Constant product',
                expr: 'x × y = k',
                terms: [
                    { sym: 'x, y', meaning: 'the two pool reserves' },
                    { sym: 'k', meaning: 'held constant by every trade — which is what forces the rebalancing' },
                ],
                worked: () => 'Buying from the pool lowers one reserve and raises the other. Keeping k constant is what makes the pool sell the winner and buy the loser.',
            },
        ],
        quiz: [
            {
                question: 'Both assets in your liquidity pool rose. Can you still have lost?',
                options: ['No', 'Yes — against simply holding them, if their relative price diverged', 'Only if fees were zero', 'Only on Ethereum'],
                answer: 1,
                why: 'The comparison is against holding, not against zero. Keeping the product constant forces the pool to sell the appreciating asset throughout the move.',
            },
            {
                question: 'What position does a liquidity provider actually hold?',
                options: ['Long both assets', 'Long fees and short volatility on the pair', 'Market neutral', 'Long the pool token only'],
                answer: 1,
                why: 'Fees are the income; divergence is the cost. That is why correlated, high-volume pools work and a volatile new token with a spectacular advertised yield usually does not.',
            },
        ],
    },

    {
        slug: 'evaluating-a-token',
        title: 'Evaluating a token without a cash flow',
        track: 'crypto',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Ask the four questions that most new tokens cannot answer well.',
        where: { href: '/research', label: 'Check supply data' },
        prereq: ['vesting-and-unlocks'],
        concept: [
            'Equity valuation discounts future cash flows. Most tokens have none, so the tools from the company track do not transfer. What remains is a set of questions that are answerable and that most projects answer badly.',
            '**What does the token do?** Not what the protocol does — what the *token* does. Is it required to use the network, does it capture fees, does it confer governance that controls anything of value? A token that is merely associated with a successful product, with no mechanism connecting the two, can be worthless while the product thrives. This is the single most common gap.',
            '**Who holds it, and what have they paid?** Read the allocation. Team and investor shares, the vesting schedule, the cliff dates. Compare **market cap to fully diluted valuation** — a large gap means most of the supply has yet to arrive, from holders whose cost basis is near zero.',
            '**Is there real usage?** On-chain data is public, and this is the great advantage of the asset class if you use it. Active addresses, transaction counts, protocol revenue, total value locked. Distinguish usage from incentivised activity: **volume that exists because it is being paid for stops when the payments stop**, and much reported activity is exactly that.',
            '**What is the security model?** Who can upgrade the contract, mint more tokens, or pause transfers? An "immutable, decentralised" protocol with an admin key held by three people is a company with extra steps, and the key is disclosed in the code.',
            'One structural caution. **Crypto market capitalisation is not money invested** — it is the last traded price multiplied by circulating supply. A thin token can show a large market cap on very little real buying, and that number cannot be withdrawn from the market. Treating it as a measure of value stored is the most common error in reading crypto data.',
        ],
        inApp: '[Research](/research) returns CoinGecko reference data — circulating, total and maximum supply, market cap, categories — which is where the supply questions above are actually checkable.',
        quiz: [
            {
                question: 'A protocol is successful and widely used. Does that make its token valuable?',
                options: ['Yes, automatically', 'Only if the token has a mechanism connecting it to that success — fee capture, required usage, or meaningful governance', 'Yes, through market cap', 'Only if supply is capped'],
                answer: 1,
                why: 'Association is not a mechanism. A token can be worthless while the product it is named after thrives, and this is the most common gap in token design.',
            },
            {
                question: 'What does crypto market capitalisation measure?',
                options: ['Money invested', 'Last traded price × circulating supply — which a thin market can inflate on very little real buying', 'Total value locked', 'Protocol revenue'],
                answer: 1,
                why: 'It is a multiplication, not a measure of capital stored, and the figure cannot be withdrawn from the market. Reading it as money invested is the most common error in crypto data.',
            },
        ],
    },

    {
        slug: 'crypto-cycles',
        title: 'Cycles, narratives and the base rate for new tokens',
        track: 'crypto',
        level: 'expert',
        kind: 'study',
        minutes: 9,
        outcome: 'Place a current enthusiasm in the pattern, and size for the distribution rather than the story.',
        where: { href: '/portfolio', label: 'Look at your exposure' },
        prereq: ['evaluating-a-token'],
        concept: [
            'Crypto has run through several boom-and-bust cycles, and the shape has been consistent enough to be worth describing — while being honest that a handful of cycles is a small sample, and pattern-matching on it is not prediction.',
            'The recurring shape: a technological or narrative catalyst, capital arriving, a proliferation of projects with the same keywords, a peak accompanied by mainstream attention, then a decline of 70–90% in which most of the projects disappear entirely. Each cycle has had its dominant narrative, and each subsequent one has had a different narrative and a similar structure.',
            'Two mechanisms drive the amplitude. **Leverage** — perpetual futures with high advertised leverage mean declines trigger liquidation cascades, which is why crypto drawdowns are faster and deeper than equity ones. And **supply schedules** — as the vesting lesson describes, new supply keeps arriving from zero-cost holders into a market whose demand is not growing at the same rate.',
            'The base rate for individual tokens is the part usually omitted from cycle discussion, and it matters more than the cycle. **The overwhelming majority of tokens launched in any cycle do not survive it.** Most trend to zero, quietly, over the following two years. The survivors are visible and heavily discussed; the failures are delisted and disappear from the charts, which is survivorship bias operating at the level of an entire asset class.',
            'What follows is a sizing conclusion, not a directional one. **If most tokens go to zero, position size must assume that outcome for any individual holding.** A portfolio of speculative tokens is not diversified in the way it appears — they are highly correlated with each other and with overall risk appetite, so the whole basket falls together.',
            'And the honest note about narratives: **a narrative can be entirely correct about the technology and still be a losing investment**, if the value accrues somewhere other than the token you own. That was true of several past cycles, and identifying it in advance is what the previous lesson\'s four questions are for.',
        ],
        inApp: '[Portfolio](/portfolio) shows exposure by market, which is where an over-concentration in one asset class becomes visible. The app treats crypto as one market — and inside it, correlations are high.',
        quiz: [
            {
                question: 'Why are crypto drawdowns faster and deeper than equity ones?',
                options: ['Lower quality assets', 'High leverage triggers liquidation cascades, and new supply keeps arriving from zero-cost holders', 'No circuit breakers exist', 'Smaller market size'],
                answer: 1,
                why: 'Leverage forces selling into falls, and vesting schedules add supply regardless of demand. Both amplify the same move.',
            },
            {
                question: 'Most tokens from a given cycle go to zero. What does that imply for sizing?',
                options: ['Buy more of the survivors', 'Size any individual token position assuming that outcome — and note that a basket of them is highly correlated, not diversified', 'Avoid crypto entirely', 'Use leverage'],
                answer: 1,
                why: 'The failures are delisted and vanish from the charts while survivors are discussed, which is survivorship bias across a whole asset class. Sizing must assume the base rate.',
            },
        ],
    },
];
