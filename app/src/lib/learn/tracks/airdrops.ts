import type { Lesson } from '../types';

// Track: airdrops.
//
// The most scam-adjacent subject in this course, and the one where the teaching that
// matters most is defensive. Fake claim sites are among the most common ways people are
// robbed in crypto, and the mechanism — an approval signature, not a stolen password —
// is genuinely counter-intuitive. Eligibility farming is covered because it was asked
// for and because understanding it is part of understanding the market; what is NOT
// here is a playbook for multi-wallet sybil farming, which is detected, punished, and
// not something worth teaching.
//
// This app has no wallet and no chain connection, so every lesson here is `study`.

export const AIRDROP_LESSONS: Lesson[] = [
    {
        slug: 'what-an-airdrop-is',
        title: 'What an airdrop is, and who pays for it',
        track: 'airdrops',
        level: 'intermediate',
        kind: 'study',
        minutes: 7,
        outcome: 'Explain why a project gives tokens away, and what it is buying.',
        where: { href: '/research', label: 'Look at crypto supply data' },
        concept: [
            'An airdrop is a project distributing its token to a set of addresses for free. It looks like a gift. It is a marketing and governance expense, paid in an asset the project can create at zero cost.',
            'The reasons are rational. A token with a handful of holders is not decentralised in any meaningful sense, and often cannot be listed. Distribution buys holders, buys attention, and buys a userbase who now have a financial reason to care. It also rewards early users who took a risk before there was any reward — which is the version projects prefer to talk about.',
            'The critical question for anyone receiving one is: **who is on the other side?** Tokens given away must come from somewhere in the supply schedule, and the supply schedule usually includes a much larger allocation to the team and to investors, released later on a vesting timetable.',
            'That is not a reason to refuse an airdrop. It is a reason to understand that the free tokens and the eventual selling pressure come from the same document, and that the document is public.',
        ],
        inApp: '[Research](/research) shows circulating versus maximum supply for the seeded crypto instruments. The gap between the two is the part not yet issued — and "uncapped" means there is no limit at all.',
        quiz: [
            {
                question: 'Why do projects run airdrops?',
                options: ['Generosity', 'To buy distribution, attention and a userbase with an asset they create at zero cost', 'Regulation requires it', 'To reduce total supply'],
                answer: 1,
                why: 'It is a marketing and governance expense denominated in the project\'s own token. Understanding that reframes the question from "what am I getting" to "what are they buying, and from whom".',
            },
            {
                question: 'Where should you look to understand future selling pressure?',
                options: ['The price chart', 'Social media sentiment', 'The token supply and vesting schedule', 'The number of holders'],
                answer: 2,
                why: 'The vesting schedule tells you how many tokens are due to unlock and when. It is published, and it is the single most useful document about a new token.',
            },
        ],
    },

    {
        slug: 'vesting-and-unlocks',
        title: 'Vesting, unlocks, and why airdropped tokens usually fall',
        track: 'airdrops',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Read a supply schedule and anticipate when selling pressure arrives.',
        where: { href: '/research', label: 'Compare circulating and max supply' },
        prereq: ['what-an-airdrop-is'],
        visual: 'token-vesting',
        concept: [
            'On listing day, only part of a token\'s supply is circulating. The rest is locked, and released on a schedule: typically a **cliff** — nothing at all for some months — followed by **linear vesting** over a year or more.',
            'The pattern this produces is well documented and nearly mechanical. Airdrop recipients received something for nothing, so a large fraction sell immediately. Then each unlock adds supply from holders whose cost basis is effectively zero, into a market whose demand has not grown at the same rate.',
            'This is why so many airdropped tokens chart the same shape: a listing spike, a steep decline over weeks, and a series of smaller declines that line up suspiciously well with the unlock calendar.',
            'None of that makes an airdrop worthless. It means the value is usually realised **early**, and that "holding for the long term" is a decision that should be made against the supply schedule rather than against a feeling about the project.',
            'The number to look for is **fully diluted valuation** — the price multiplied by the *total* supply rather than the circulating supply. A token trading at a modest market cap with 90% of its supply still locked is not cheap; it is expensive with most of the bill deferred.',
        ],
        inApp: '[Research](/research) reports circulating supply, total supply and maximum supply separately, because the differences between those three are the whole story.',
        formulas: [
            {
                label: 'Fully diluted valuation',
                expr: 'FDV = price × total supply',
                terms: [
                    { sym: 'total supply', meaning: 'everything that will exist, not just what trades today' },
                ],
                worked: () => 'A token at $1 with 100m circulating and 1bn total has a $100m market cap and a $1bn FDV. Those are very different propositions.',
            },
        ],
        quiz: [
            {
                question: 'A token has a $50m market cap and a $2bn fully diluted valuation. What does that tell you?',
                options: ['It is cheap', 'Roughly 97% of the supply is not yet circulating, and will arrive later', 'It has no maximum supply', 'The market cap is wrong'],
                answer: 1,
                why: 'The gap between market cap and FDV is supply that has not arrived yet. Buying at a low market cap while ignoring FDV is buying into a queue of future sellers.',
            },
            {
                question: 'What is a cliff in a vesting schedule?',
                options: ['A price floor', 'A period during which nothing unlocks, followed by a release', 'The maximum supply', 'A type of airdrop'],
                answer: 1,
                why: 'A cliff delays the first release entirely. The date it ends is often visible in the price chart, because everyone can read the same schedule.',
            },
        ],
    },

    {
        slug: 'airdrop-eligibility',
        title: 'Eligibility: what actually gets rewarded',
        track: 'airdrops',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Understand how eligibility is decided, and why gaming it usually fails.',
        where: { href: '/learn', label: 'Back to the track' },
        prereq: ['vesting-and-unlocks'],
        concept: [
            'Eligibility is decided by a snapshot: at some past block, the project looks at on-chain history and picks addresses. Criteria commonly include having used the protocol before a date, transacting above some threshold, providing liquidity, holding across a period, or bridging assets in.',
            'The criteria are almost always announced **after** the snapshot, precisely so they cannot be gamed. That single design decision is why "farming" is far less reliable than it sounds: you are guessing at a rule that has not been written yet.',
            'What consistently does get rewarded is **genuine early use**. Real usage, sustained over time, from an address that also does other things, looks exactly like what projects say they want — because it is.',
            '**On sybil farming — using many wallets to multiply eligibility — I am not going to give you a playbook, and it is worth saying why rather than just declining.** Projects now run clustering analysis over funding paths, timing correlation and behavioural fingerprints, and large-scale disqualifications are routine. Several major distributions have removed tens of thousands of addresses. The realistic outcome is that the effort is wasted and the addresses are flagged. It is also, straightforwardly, an attempt to take a larger share of a distribution by pretending to be many people.',
            'The honest expected value: most farming yields nothing, a few yield a modest amount, and the genuinely large outcomes went overwhelmingly to people who were using the thing anyway. If you would not use the protocol without the airdrop, the airdrop is a poor reason to use it.',
        ],
        inApp: 'Nothing in this app touches a wallet or a chain, so none of this can be practised here. It is included because understanding distribution is part of understanding crypto markets.',
        quiz: [
            {
                question: 'Why are eligibility criteria usually announced after the snapshot?',
                options: ['Administrative delay', 'So they cannot be gamed — you are guessing at a rule not yet written', 'Regulation requires it', 'To increase the token price'],
                answer: 1,
                why: 'A published rule is a specification for farming it. Announcing afterwards is the main defence projects have, and it is why farming is guesswork rather than strategy.',
            },
            {
                question: 'What is the realistic outcome of multi-wallet sybil farming today?',
                options: ['Reliable multiplied rewards', 'Detection and disqualification are routine, so the effort is usually wasted', 'It is impossible to detect', 'It is required for eligibility'],
                answer: 1,
                why: 'Clustering on funding paths and timing correlation catches most of it, and mass disqualifications have happened on several large distributions.',
            },
        ],
    },

    {
        slug: 'airdrop-tax-india',
        title: 'Airdrops and Indian tax: taxed twice',
        track: 'airdrops',
        level: 'advanced',
        kind: 'study',
        minutes: 7,
        outcome: 'Know that a free token creates a tax event on arrival, before you sell anything.',
        where: { href: '/funds', label: 'See how costs are tracked' },
        prereq: ['what-an-airdrop-is'],
        concept: [
            'This surprises almost everyone: in India, receiving an airdrop is generally a **taxable event at the moment of receipt**, valued at the fair market value of the tokens when they arrive. You have income before you have sold anything, and before you have any rupees with which to pay the tax.',
            'Then, when you dispose of the tokens, there is a **second** event: gains on virtual digital assets are taxed at a flat rate, with the value taxed at receipt forming your cost of acquisition.',
            'Two structural features of the Indian VDA regime make this sharper than it sounds. There is a **TDS deducted at source** on transfers, and — critically — **losses on virtual digital assets cannot be set off** against other gains, or carried forward. A profitable trade and a loss-making one do not net out.',
            'Combine those and a bad case appears easily: tokens arrive at a high price and are taxed at that value, the price then falls 80%, you sell — and the loss does not offset the income you were taxed on. You can owe tax on money you never had.',
            '**Rates and thresholds change with the budget, so this lesson deliberately does not quote them.** What does not change is the structure: income on receipt, tax on disposal, no loss set-off. Plan around the structure, verify the numbers, and talk to a chartered accountant if the amounts are meaningful.',
        ],
        inApp: 'This simulator does not model tax at all — only trading charges, on [Funds](/funds). Tax is a separate and, for crypto in India, unusually punitive layer.',
        quiz: [
            {
                question: 'When does an airdrop first create a tax liability in India?',
                options: ['Only when you sell', 'On receipt, at the tokens\' value at that moment', 'Never, it was free', 'Only above ₹1 lakh'],
                answer: 1,
                why: 'Receipt is generally income at fair market value. You can owe tax before you have sold anything and before you hold any rupees.',
            },
            {
                question: 'Why is the no-set-off rule for virtual digital assets so damaging?',
                options: ['It raises the rate', 'A losing trade cannot offset a winning one, so you are taxed on gross gains', 'It delays refunds', 'It applies only to airdrops'],
                answer: 1,
                why: 'Losses do not net against gains and cannot be carried forward. A portfolio that broke even overall can still generate a substantial tax bill.',
            },
        ],
        resources: [
            { kind: 'article', title: 'Varsity: Markets and Taxation', by: 'Zerodha', url: 'https://zerodha.com/varsity/module/markets-and-taxation/', why: 'Kept current as budgets change, with worked examples.' },
        ],
    },

    {
        slug: 'how-wallets-get-drained',
        title: 'How wallets actually get drained',
        track: 'airdrops',
        level: 'advanced',
        kind: 'study',
        minutes: 10,
        outcome: 'Recognise the three mechanisms behind most crypto theft, and why none of them need your password.',
        where: { href: '/learn', label: 'Back to the track' },
        prereq: ['what-an-airdrop-is'],
        concept: [
            'Most people picture crypto theft as a stolen password. Almost none of it works that way, and that mental model is exactly what makes the real attacks effective — you are watching for the wrong thing.',
            '**Fake claim sites.** An airdrop is announced; dozens of near-identical claim pages appear within hours, promoted through compromised accounts, paid search and replies to the official post. The page looks right because it is usually a copy of the real one. You connect your wallet and sign what appears to be a claim.',
            '**Infinite approvals.** On most chains, spending a token requires granting a contract permission to move it. The convenient default is *unlimited*, forever. That approval is a standing authorisation: the contract can drain that token at any point in the future, long after you have forgotten the site. Approvals persist until you explicitly revoke them, and a wallet can accumulate dozens.',
            '**Signature phishing.** The most dangerous, because nothing appears to move. You are asked to sign a message — not a transaction, no gas, no obvious cost. But the message is a structured permission (a `Permit`, or a marketplace order) that authorises transfer of your assets. The wallet shows an unreadable blob, and people sign it because signing has always been harmless.',
            'What actually protects you, in order of effectiveness. **Navigate to claim sites yourself** from a source you already trusted before the airdrop existed — never from a link in a reply, a DM or an advertisement. **Use a separate wallet** for claiming, holding nothing you would mind losing. **Read what you are signing**, and treat an unreadable signature request as a refusal. **Revoke approvals** periodically. And hold anything significant in a **hardware wallet**, which cannot sign without physical confirmation.',
            'One rule covers most of it: **urgency is the tell**. "Claim within 24 hours or forfeit" exists to stop you checking. Real distributions are claimable for months.',
        ],
        inApp: 'This app never touches a wallet, holds no keys and cannot sign anything — so nothing here can be drained. That is worth stating plainly, since the same cannot be said of most crypto tools.',
        quiz: [
            {
                question: 'You sign a message on a claim site. No transaction, no gas fee. Are you safe?',
                options: ['Yes, signing costs nothing', 'No — a signature can authorise transfers, and this is the most dangerous attack precisely because nothing appears to happen', 'Only if you disconnect afterwards', 'Only on Ethereum'],
                answer: 1,
                why: 'A structured signature such as a Permit grants transfer authority without any on-chain transaction from you. It is dangerous because it feels harmless, and because the wallet usually cannot render it legibly.',
            },
            {
                question: 'What is an "infinite approval"?',
                options: ['A wallet with no password', 'A standing, unlimited authorisation for a contract to move that token, lasting until you revoke it', 'A transaction that never confirms', 'A very large airdrop'],
                answer: 1,
                why: 'Approvals persist indefinitely. A site you used once and forgot can retain the right to move a token years later, which is why periodic revocation matters.',
            },
            {
                question: 'A claim page says the airdrop expires in 6 hours. What does that suggest?',
                options: ['Claim quickly', 'Urgency exists to stop you checking — real distributions stay claimable for months', 'It is a small airdrop', 'The gas fee will rise'],
                answer: 1,
                why: 'Manufactured urgency is the most consistent signal of a scam, in crypto and everywhere else. It is engineered to defeat exactly the pause that would save you.',
            },
        ],
        resources: [
            { kind: 'article', title: 'Cryptocurrency and security', url: 'https://en.wikipedia.org/wiki/Cryptocurrency_wallet', why: 'Neutral background on custody, keys and wallet types.' },
        ],
    },
];
