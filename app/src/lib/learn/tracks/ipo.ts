import type { Lesson } from '../types';

// Track: IPOs.
//
// India-weighted, because /api/ipo serves live NSE issues and because the Indian IPO
// process — book building, category-wise allotment, the lottery for small applicants —
// differs enough from the US that generic material misleads.

export const IPO_LESSONS: Lesson[] = [
    {
        slug: 'what-an-ipo-is',
        title: 'What an IPO is, and who is selling',
        track: 'ipo',
        level: 'foundation',
        kind: 'study',
        minutes: 7,
        outcome: 'Distinguish a fresh issue from an offer for sale, and know why the difference matters to you.',
        where: { href: '/research', label: 'See live IPOs' },
        concept: [
            'An initial public offering is the first time a company\'s shares are sold to the public. After it, the shares trade on an exchange and anyone can buy them.',
            'The critical distinction, and the one most coverage skips: **where does your money go?**',
            'In a **fresh issue**, the company creates new shares and receives the proceeds. The money funds the business — expansion, debt repayment, working capital. Existing shareholders are diluted.',
            'In an **offer for sale (OFS)**, existing shareholders — founders, early investors, private equity — sell shares they already own. The company receives nothing. This is an exit, and the buyer of that exit is you.',
            'Neither is wrong. Early investors are entitled to sell, and an OFS is often how a company achieves the public float it needs. But an IPO that is 90% OFS is a liquidity event for insiders, and an IPO that is 90% fresh issue is a fundraise. Those are different propositions, and the split is stated plainly in the prospectus.',
            'The question worth asking about any IPO: **why are they selling now?** Companies and their bankers choose the timing, and they choose it when they believe the price is good — which by definition means good for the seller.',
        ],
        inApp: '[Research](/research) pulls live current issues from NSE. When there are none, it says so rather than showing stale ones — a quiet IPO market is real information.',
        quiz: [
            {
                question: 'In an offer for sale, who receives your money?',
                options: ['The company', 'The existing shareholders who are selling', 'The exchange', 'SEBI'],
                answer: 1,
                why: 'An OFS transfers existing shares; the company gets nothing. It is an exit for insiders. That is legitimate but it is not a fundraise, and the prospectus states the split.',
            },
            {
                question: 'Who chooses when a company goes public?',
                options: ['The exchange', 'SEBI', 'The company and its bankers — when they judge the price is favourable', 'A fixed regulatory calendar'],
                answer: 2,
                why: 'The seller picks the timing. IPO waves cluster in strong markets for exactly that reason, which is worth remembering when a hot pipeline is described as a sign of confidence.',
            },
        ],
    },

    {
        slug: 'book-building-and-lots',
        title: 'Book building, price bands and lot size',
        track: 'ipo',
        level: 'foundation',
        kind: 'study',
        minutes: 7,
        outcome: 'Read an issue\'s terms and work out what applying actually costs you.',
        where: { href: '/research', label: 'Look at an issue\'s terms' },
        prereq: ['what-an-ipo-is'],
        concept: [
            'Most Indian IPOs are **book built**. The company announces a **price band** — a floor and a cap — and takes bids across it over a three-day window. At the close, the final **cut-off price** is set from the demand received.',
            'You do not apply for a number of shares of your choosing. You apply in **lots**: a fixed quantity set so that one lot costs roughly ₹14,000–₹15,000 for a retail applicant. You can apply for one lot, two, or more, up to the ₹2 lakh retail ceiling.',
            'Small applicants almost always bid at **cut-off**, meaning "whatever the final price is". Bidding below the eventual cut-off means you are simply not allotted. There is no prize for bidding low.',
            'Your money is not debited when you apply. Under **ASBA** — Applications Supported by Blocked Amount — the funds are *blocked* in your bank account. They stay yours, and they keep earning interest, until shares are allotted. If you get nothing, the block is released. This is a genuinely good piece of market design and it is worth knowing it exists.',
            'The **subscription figures** published each day tell you how many times over the issue has been applied for, per category. A retail portion subscribed 40× means roughly one applicant in forty gets one lot.',
        ],
        inApp: 'This app does not place IPO applications — it has no broker connection. [Research](/research) shows the live issues and their terms so the lessons have something real to read.',
        quiz: [
            {
                question: 'Under ASBA, when is your money debited?',
                options: ['When you apply', 'When you bid at cut-off', 'Only on allotment — until then it is blocked in your own account and still earns interest', 'On listing day'],
                answer: 2,
                why: 'ASBA blocks rather than debits. Uninterested-in funds sitting with an intermediary for two weeks was the problem it solved.',
            },
            {
                question: 'The retail portion is subscribed 40 times. What does that imply?',
                options: ['The price will rise 40%', 'Roughly one applicant in forty receives an allotment', 'Everyone gets 1/40th of a lot', 'The issue will be cancelled'],
                answer: 1,
                why: 'Retail allotment is by lottery in whole lots, not proportional. Heavy subscription means most applicants receive nothing at all.',
            },
        ],
    },

    {
        slug: 'allotment-and-categories',
        title: 'Allotment: why applying for more rarely helps',
        track: 'ipo',
        level: 'intermediate',
        kind: 'study',
        minutes: 8,
        outcome: 'Understand the category split and why the retail lottery favours one application per person.',
        where: { href: '/research', label: 'Check subscription figures' },
        prereq: ['book-building-and-lots'],
        concept: [
            'An issue is divided into reserved portions. **QIB** — qualified institutional buyers. **NII/HNI** — non-institutional, applications above ₹2 lakh. **RII** — retail individual investors, up to ₹2 lakh. There are often small reservations for employees and, occasionally, shareholders of a parent company.',
            'The categories are allotted separately, and by different rules. Institutional allotment is discretionary and proportional. Retail is **a lottery in whole lots**.',
            'That lottery design has a consequence people consistently get wrong. When the retail portion is oversubscribed, SEBI\'s rules ensure that **as many applicants as possible receive at least one lot**. Applying for five lots does not multiply your chances of winning the draw for one — in a heavily oversubscribed issue, the five-lot applicant and the one-lot applicant are competing for the same single-lot allotment, and the larger application simply blocks more of your money.',
            'What genuinely does increase your odds is applying from **multiple distinct PANs** within a household — one per family member with their own demat account. Multiple applications on the same PAN are rejected outright.',
            'The high-net-worth category behaves differently again: it is allotted proportionally, which is why HNI applicants often borrow heavily for a few days to scale up an application. That is a leveraged bet on listing-day pricing, with interest costs, and it is not a retail strategy.',
        ],
        inApp: 'Nothing here is placeable in this app. The purpose of this lesson is that the mechanics decide the outcome more than any view on the company does.',
        quiz: [
            {
                question: 'In a heavily oversubscribed retail portion, what does applying for 5 lots instead of 1 achieve?',
                options: ['Five times the chance', 'Guaranteed allotment', 'Usually nothing but more blocked money — the rules maximise the number of applicants getting one lot', 'A better price'],
                answer: 2,
                why: 'Retail allotment is a lottery in whole lots designed to spread allotments as widely as possible. A larger application competes in the same draw while blocking more capital.',
            },
            {
                question: 'What happens to two applications on the same PAN?',
                options: ['Both are allotted', 'Both are rejected', 'The larger one counts', 'They are merged'],
                answer: 1,
                why: 'Duplicate PAN applications are rejected. Separate family members with their own PAN and demat account are the legitimate way to submit more than one application.',
            },
        ],
    },

    {
        slug: 'grey-market-premium',
        title: 'Grey market premium: an unregulated rumour with a number attached',
        track: 'ipo',
        level: 'intermediate',
        kind: 'study',
        minutes: 7,
        outcome: 'Interpret GMP for what it is, and know why it moves the way it does.',
        where: { href: '/research', label: 'Back to Research' },
        prereq: ['allotment-and-categories'],
        concept: [
            '**Grey market premium** is the price at which an IPO\'s shares are informally traded before listing, quoted as a premium to the issue price. A GMP of ₹120 on a ₹500 issue implies an expected listing around ₹620.',
            'It is worth being precise about what this is. The grey market is **unregulated and unofficial**. It has no exchange, no clearing, no settlement guarantee, and no regulator. The quoted numbers come from a small number of dealers, are not audited, and are not verifiable by you.',
            'It is also **thin**. Volumes are tiny relative to the issue, so the "market price" can be moved by a handful of trades — and the people quoting it frequently have a position in the outcome, including an interest in a strong retail response.',
            'Empirically GMP does correlate with listing-day pops, which is exactly why it persists. But it is a sentiment reading, not a forecast, and it collapses fast: a strong GMP a week before listing routinely evaporates as the subscription numbers land or the market turns.',
            'Two failure modes to hold in mind. It is **circular** — retail applies because GMP is high, subscription rises, GMP rises further, and nothing about the business has changed. And it says **nothing at all about value**; it is a guess about the first hour of trading, which is the least informative hour a stock ever has.',
        ],
        inApp: 'This app does not display GMP, and will not. There is no verifiable source for it, and printing an unverifiable number beside real ones is exactly what the project rule forbids.',
        quiz: [
            {
                question: 'What is the grey market premium?',
                options: ['An official pre-listing price from the exchange', 'An unregulated, unaudited informal quote from a small set of dealers', 'SEBI\'s valuation of the issue', 'The difference between the floor and cap price'],
                answer: 1,
                why: 'There is no exchange, no clearing and no regulator behind it. It is a sentiment reading with a decimal point, and it is often quoted by people with a position in the outcome.',
            },
            {
                question: 'Why is GMP described as circular?',
                options: ['It repeats daily', 'High GMP drives retail applications, which raise subscription, which raise GMP — with nothing learned about the business', 'It is calculated from the issue price', 'It always returns to zero'],
                answer: 1,
                why: 'The feedback loop between GMP and subscription is self-reinforcing and carries no information about the company. That is what makes a rising GMP feel like confirmation when it is an echo.',
            },
        ],
    },

    {
        slug: 'reading-the-drhp',
        title: 'Reading the prospectus: where the money goes',
        track: 'ipo',
        level: 'advanced',
        kind: 'study',
        minutes: 10,
        outcome: 'Find the four sections of a DRHP that actually change a decision.',
        where: { href: '/research', label: 'Back to Research' },
        prereq: ['what-an-ipo-is'],
        concept: [
            'The **DRHP** — draft red herring prospectus — is filed with SEBI and runs to several hundred pages. Almost nobody reads all of it, and almost nobody needs to. Four sections carry most of the decision-relevant content.',
            '**Objects of the issue.** What the fresh-issue proceeds will be spent on, stated specifically. "Funding capital expenditure at the Pune facility" is a plan. "General corporate purposes" is not, and a large share allocated to it is a signal. Note also how much of the total is fresh issue at all — the rest goes to selling shareholders.',
            '**Risk factors.** Written by lawyers to protect the company, which makes them unusually candid. The first few are usually ordered by seriousness and are worth reading in full. Look specifically for customer concentration, dependence on a single product or geography, pending litigation, and regulatory approvals not yet obtained.',
            '**Financial statements — the restated ones.** Read three to five years, not one. The pattern that recurs across disappointing IPOs is a sharp margin or revenue improvement in the year immediately before filing. That may be genuine operating leverage. It may also be a company presenting its best possible year to the market. Check whether receivables and inventory grew faster than revenue: if profits rose but cash from operations did not, ask why.',
            '**Related-party transactions and promoter holding.** Money moving between the company and entities its promoters control deserves attention, as does how much the promoters retain post-issue and what is locked in.',
            'Finally, **valuation**. The prospectus gives a peer comparison table — chosen by the company, from peers it selected. Compute the P/E at the upper price band against the latest full-year earnings yourself, and compare it to peers you choose.',
        ],
        inApp: '[Research](/research) provides fundamentals for US listings via Finnhub. **There is no free API for Indian company fundamentals** — Alpha Vantage returns an empty object for NSE symbols — so Indian analysis here means reading the filing yourself. That is a real limitation, stated rather than papered over.',
        quiz: [
            {
                question: 'Which "objects of the issue" line deserves the most scepticism?',
                options: ['Repayment of borrowings', 'Capital expenditure at a named facility', 'A large allocation to "general corporate purposes"', 'Working capital'],
                answer: 2,
                why: 'The other three are specific and checkable later. A large unspecified allocation means the money has no stated plan, and no way for you to judge whether it was used well.',
            },
            {
                question: 'Profits jumped sharply in the year before filing, but cash from operations did not. What should you check?',
                options: ['Nothing, profit is profit', 'Whether receivables and inventory grew faster than revenue', 'The GMP', 'The lot size'],
                answer: 1,
                why: 'Profit that has not turned into cash usually sits in receivables or inventory. It can be growth; it can also be revenue recognised on sales not yet collected, timed for the filing.',
            },
        ],
        resources: [
            { kind: 'regulator', title: 'SEBI — filings and offer documents', url: 'https://www.sebi.gov.in/', why: 'Every DRHP is filed here and free to read. The primary source, not a summary of it.' },
        ],
    },

    {
        slug: 'listing-day-evidence',
        title: 'Listing day, and what the evidence says about IPO returns',
        track: 'ipo',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Separate the listing pop from the long-run record, and size an application accordingly.',
        where: { href: '/portfolio', label: 'Think about position size' },
        prereq: ['grey-market-premium'],
        concept: [
            'Two very different things get called "IPO returns", and conflating them is the single most common mistake in this subject.',
            '**The listing pop** is the move from issue price to the first day\'s close. On average, across many markets and many decades, it is positive — this is the well-documented underpricing phenomenon. Bankers price slightly below what the market will bear, because a failed issue is far more damaging to them than a cheap one.',
            '**Long-run performance** is a separate and much less flattering record. Across international studies, IPOs as a class have tended to **underperform** comparable already-listed companies over the following one to three years. The listing pop and the long-run drift point in opposite directions.',
            'That combination has a clear implication: the historical edge, such as it is, has been in **getting an allotment and selling into the listing**, not in holding. Which is precisely why allotment is rationed by lottery — the profitable part is the scarce part.',
            'Listing day itself is volatile and thin. Price discovery happens in a pre-open call auction, and a special pre-open session sets the opening price. Circuit bands apply from day one. If you are trading it, treat the first thirty minutes as an auction with wide spreads rather than as a market with a fair price.',
            'The practical framing: **an IPO application is a lottery ticket with a positive historical expected value and no ability to size your position.** You cannot choose to receive more when you are more confident. So decide what the company is worth to you at the band, apply or do not, and make the decision to hold a fresh one after listing — separately from the decision to apply.',
        ],
        inApp: 'You can practise the post-listing decision here once a stock is trading: add it on [Terminal](/terminal) and size it as you would any position.',
        quiz: [
            {
                question: 'What does the international evidence broadly show about IPOs?',
                options: ['Positive on listing day and positive over three years', 'A positive average listing pop, but underperformance versus comparable listed firms over the following years', 'Negative on listing day', 'Identical to the index'],
                answer: 1,
                why: 'Underpricing at listing and long-run underperformance are both well documented and point in opposite directions. "IPOs do well" is true only of the first day.',
            },
            {
                question: 'Why is an IPO application unlike a normal position decision?',
                options: ['It is free', 'You cannot size it — allotment is rationed, so conviction cannot be expressed as a larger position', 'It has no risk', 'It settles instantly'],
                answer: 1,
                why: 'You may apply, but you cannot decide how much you receive. The holding decision after listing is a separate one, and worth making separately.',
            },
        ],
    },
];
