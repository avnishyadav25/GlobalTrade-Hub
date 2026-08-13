import type { Lesson } from '../types';

// Track: reading a company.
//
// Accounting is the most durable subject in this course — the structure of a balance
// sheet has not changed in a century and will not change with the next budget. That
// makes it the one place where specifics can be stated confidently.
//
// Worked examples use round invented numbers rather than a real company's figures.
// A real company's numbers would need a citation and a date, and would go stale;
// invented ones make the arithmetic visible without pretending to be current data.

export const COMPANY_LESSONS: Lesson[] = [
    {
        slug: 'three-statements',
        title: 'The three statements, and how they lock together',
        track: 'company',
        level: 'intermediate',
        kind: 'study',
        minutes: 9,
        outcome: 'Explain what each statement measures and how a single transaction touches all three.',
        where: { href: '/research', label: 'Pull real fundamentals' },
        visual: 'three-statements',
        concept: [
            'Every annual report contains three financial statements. They are not three views of the same number — they answer three different questions, and the relationship between them is where the information lives.',
            '**The income statement** covers a period and asks: *did the company make a profit?* Revenue at the top, costs subtracted in order, net income at the bottom.',
            '**The balance sheet** is a snapshot at one instant and asks: *what does the company own and owe?* Assets on one side; liabilities and equity on the other. It balances by construction — everything owned was funded either by borrowing or by owners.',
            '**The cash flow statement** covers a period and asks: *did money actually move?* It starts from net income and adjusts for everything that was recorded but did not involve cash.',
            'They interlock in a way worth memorising, because it is what makes fraud hard. **Net income from the income statement flows into retained earnings on the balance sheet.** **The cash flow statement begins at net income and ends at the cash line on the balance sheet.** Change one number and the others must move consistently or the statements do not balance.',
            'Trace a single sale on credit. Income statement: revenue and profit rise. Balance sheet: receivables rise, and retained earnings rise by the profit. Cash flow: net income rises, but the increase in receivables is subtracted straight back out — **so operating cash flow does not move at all.** That is the entire mechanism behind "profitable but running out of cash", and it has ended real companies.',
        ],
        inApp: '[Research](/research) fetches real fundamentals for US symbols from Finnhub — margins, ROE, debt to equity. These are the ratios computed from exactly these three statements.',
        quiz: [
            {
                question: 'A company makes a sale on credit. What happens to operating cash flow?',
                options: ['It rises by the profit', 'It rises by the sale value', 'Nothing — the profit is added and the receivable increase is subtracted straight back out', 'It falls'],
                answer: 2,
                why: 'This is the central mechanism of the three statements. Profit rose and cash did not, which is exactly how a profitable company runs out of money.',
            },
            {
                question: 'Why does the balance sheet always balance?',
                options: ['Auditors force it', 'By construction — everything owned was funded either by borrowing or by owners', 'It is rounded', 'It does not always'],
                answer: 1,
                why: 'Assets = liabilities + equity is an identity, not a finding. It balances because every asset has a funding source on the other side.',
            },
        ],
    },

    {
        slug: 'income-statement',
        title: 'The income statement, line by line',
        track: 'company',
        level: 'intermediate',
        kind: 'study',
        minutes: 9,
        outcome: 'Walk from revenue to net income and know which line each cost belongs to.',
        where: { href: '/research', label: 'Compare margins' },
        visual: {
            kind: 'waterfall',
            caption: "A waterfall. Each line subtracts a category, and each subtotal answers a different question.",
            steps: [
                { label: "revenue", tone: 'accent', value: 1000 },
                { label: "cost of goods", note: "\u2212600", tone: 'down', value: 600 },
                { label: "gross profit", note: "400 \u00b7 40%", tone: 'up', value: 400 },
                { label: "operating expenses", note: "\u2212250", tone: 'down', value: 250 },
                { label: "operating profit", note: "150 \u00b7 15%", tone: 'up', value: 150 },
                { label: "interest + tax", note: "\u221260", tone: 'down', value: 60 },
                { label: "net income", note: "90 \u00b7 9%", tone: 'up', value: 90 },
            ],
        },
        prereq: ['three-statements'],
        concept: [
            'The income statement is a waterfall. Each line subtracts a category of cost, and each intermediate total answers a different question.',
            '**Revenue** — what the company billed. Note this is *recognised* revenue, not cash collected, and the rules for when revenue may be recognised are the most manipulated area in accounting.',
            '**Cost of goods sold**, subtracted, gives **gross profit**. This is the direct cost of producing what was sold. Gross margin is the purest measure of pricing power a single line can give you: it says what the company can charge over what the product costs to make.',
            '**Operating expenses** — salaries, marketing, R&D, administration — subtracted, give **operating profit** (EBIT). This is profit from the actual business, before financing and tax. For comparing two companies\' operations it is usually the most useful line on the statement.',
            '**Interest**, then **tax**, give **net income**. Interest reflects how the company chose to fund itself; tax reflects jurisdiction and structure. Neither says much about whether the business is good, which is why operating profit is often the more informative comparison.',
            'Two lines deserve suspicion. **"Exceptional" or "one-off" items** appear every single year at some companies — if a charge recurs annually it is not exceptional, it is a cost being kept out of the headline. And **depreciation and amortisation** are real costs recorded without cash leaving; this is why EBITDA, which adds them back, systematically flatters capital-intensive businesses. A steel plant genuinely wears out.',
        ],
        inApp: '[Research](/research) reports net margin and operating margin for US symbols. Comparing two companies in the same industry is the exercise; comparing across industries mostly measures the industry.',
        formulas: [
            {
                label: 'The waterfall',
                expr: 'revenue − COGS = gross profit − opex = operating profit − interest − tax = net income',
                terms: [
                    { sym: 'gross margin', meaning: 'gross profit ÷ revenue — pricing power' },
                    { sym: 'operating margin', meaning: 'operating profit ÷ revenue — operational efficiency' },
                ],
                worked: () => 'Revenue 1000, COGS 600, opex 250, interest 30, tax 30 → gross 400 (40%), operating 150 (15%), net 90 (9%).',
            },
        ],
        quiz: [
            {
                question: 'Which line best compares the operations of two companies with different debt levels?',
                options: ['Net income', 'Operating profit — it is before financing costs', 'Revenue', 'EBITDA'],
                answer: 1,
                why: 'Net income is after interest, so it mixes operating quality with funding choices. Operating profit isolates the business itself.',
            },
            {
                question: 'A company reports an "exceptional item" every year for five years. What does that suggest?',
                options: ['Bad luck', 'It is a recurring cost being kept out of the headline profit', 'Strong growth', 'An accounting rule'],
                answer: 1,
                why: 'Exceptional means non-recurring. A charge that recurs annually is an operating cost wearing a label that excludes it from the number people quote.',
            },
        ],
    },

    {
        slug: 'balance-sheet',
        title: 'The balance sheet: what is owned and who funded it',
        track: 'company',
        level: 'intermediate',
        kind: 'study',
        minutes: 9,
        outcome: 'Read the funding structure and spot a liquidity problem before it arrives.',
        where: { href: '/research', label: 'Check debt to equity' },
        visual: {
            kind: 'nested',
            caption: "It balances by construction: everything owned was funded either by borrowing or by owners.",
            steps: [
                { label: "assets", note: "what the company controls", tone: 'accent' },
                { label: "liabilities", note: "what somebody else has a claim on", tone: 'down' },
                { label: "equity", note: "the residual \u2014 what is left, not what was put in", tone: 'up' },
            ],
        },
        prereq: ['income-statement'],
        concept: [
            'The balance sheet is a photograph taken on one day — usually the last day of the financial year, which is also the day a company has the most incentive to look its best.',
            '**Assets** are split into current (expected to become cash within a year: cash, receivables, inventory) and non-current (property, plant, intangibles, goodwill). **Liabilities** split the same way: current (payables, short-term borrowings, the portion of long-term debt due within a year) and non-current.',
            'The difference between assets and liabilities is **equity** — the shareholders\' residual claim. It is what is left, not what was invested.',
            'The first thing to check is **liquidity**: can it pay what falls due within the year? Current assets against current liabilities. A company with large long-term assets and a current ratio below one is solvent on paper and can still fail, because bankruptcy is caused by running out of cash, not by negative net worth.',
            'The second is **leverage**: debt against equity. Debt magnifies returns in both directions and, critically, it must be serviced regardless of how the year went. The relevant question is not the ratio in isolation but whether operating profit comfortably covers interest — and what happens to that coverage if profit halves.',
            '**Goodwill** deserves its own paragraph. It appears when a company buys another for more than the value of its identifiable assets — the premium paid. It is not a productive asset; it is a record of a price. When the acquisition disappoints, goodwill is written down, and a large goodwill balance is a large potential future charge sitting in plain sight.',
        ],
        inApp: '[Research](/research) shows debt-to-equity for US symbols. Read it alongside the margins — high leverage on thin margins is a very different company from high leverage on fat ones.',
        formulas: [
            {
                label: 'The identity, and two checks',
                expr: 'assets = liabilities + equity    ·    current ratio = current assets ÷ current liabilities    ·    interest cover = operating profit ÷ interest',
                terms: [{ sym: 'interest cover', meaning: 'how many times over the year\'s profit pays the year\'s interest' }],
                worked: () => 'Operating profit 150 against interest 30 is 5× cover. If profit halves to 75, cover falls to 2.5× — still fine. At 1× the company is working for its lenders.',
            },
        ],
        quiz: [
            {
                question: 'What causes a company to fail?',
                options: ['Negative equity', 'Running out of cash to pay what is due', 'A falling share price', 'Low margins'],
                answer: 1,
                why: 'Insolvency on paper and inability to pay are different. Companies with positive net worth fail every year because the cash was not there on the day an obligation came due.',
            },
            {
                question: 'What is goodwill?',
                options: ['Brand value the company built', 'The premium paid over identifiable assets in an acquisition — a record of a price, and a future write-down risk', 'Customer loyalty', 'Retained earnings'],
                answer: 1,
                why: 'It arises only from acquisitions, and it records what was paid rather than what was received. A large balance is a large potential charge visible years in advance.',
            },
        ],
    },

    {
        slug: 'cash-flow-statement',
        title: 'Cash flow: the statement that is hardest to fake',
        track: 'company',
        level: 'intermediate',
        kind: 'study',
        minutes: 9,
        outcome: 'Read the three sections and tell a growing company from a struggling one.',
        where: { href: '/research', label: 'Back to Research' },
        visual: {
            kind: 'flow',
            caption: "The sign pattern across the three sections tells the story faster than any single figure.",
            steps: [
                { label: "operating +", note: "the business funds itself", tone: 'up' },
                { label: "investing \u2212", note: "it is buying things to grow" },
                { label: "financing \u2212", note: "and returning capital", tone: 'accent' },
            ],
        },
        prereq: ['balance-sheet'],
        concept: [
            'Profit involves judgement — when to recognise revenue, how fast to depreciate, what to provision for. Cash involves none. Money is either in the bank or it is not, which is why experienced readers go to this statement first.',
            'It has three sections, and their **signs together** tell you more than any single figure.',
            '**Operating** — cash from running the business. For any mature company this should be positive and should broadly track net income over several years. A persistent gap between the two is the most reliable warning sign in financial analysis.',
            '**Investing** — cash spent on or received from long-term assets. Usually negative at a growing company, because growth requires buying things. Persistently positive investing cash flow often means assets are being sold, which is worth understanding rather than celebrating.',
            '**Financing** — cash from or to lenders and shareholders. Positive means raising money; negative means repaying debt, buying back shares, or paying dividends.',
            'The pattern reads at a glance. **Operating positive, investing negative, financing negative** is a mature, self-funding company generating enough to invest and still return capital. **Operating negative, financing positive** is a company staying alive on external money — which is normal for an early-stage business and alarming for a mature one.',
            'The number to compute yourself is **free cash flow**: operating cash flow minus capital expenditure. It is what remains after keeping the business running, and it is what can actually be paid out, used to repay debt, or reinvested. Reported profit cannot do any of those things.',
        ],
        inApp: 'None of this is simulated in the app — it is how you evaluate a real company before deciding it belongs in your book. [Research](/research) provides the ratios; the statements themselves are in the filing.',
        formulas: [
            {
                label: 'Free cash flow',
                expr: 'FCF = operating cash flow − capital expenditure',
                terms: [{ sym: 'capex', meaning: 'spending on long-term assets, from the investing section' }],
                worked: () => 'Operating cash 200, capex 120 → FCF 80. That 80 is what can be paid out or reinvested; the reported profit cannot be spent.',
            },
        ],
        quiz: [
            {
                question: 'Operating cash flow is negative and financing is strongly positive at a twenty-year-old company. What does that pattern say?',
                options: ['Rapid growth', 'The business is not funding itself and is staying alive on external money', 'Strong dividends', 'It is normal'],
                answer: 1,
                why: 'Normal for an early-stage business, alarming for a mature one. The sign pattern across the three sections tells the story faster than any single number.',
            },
            {
                question: 'Why do experienced readers go to the cash flow statement first?',
                options: ['It is shortest', 'Profit involves judgement; cash does not', 'It is audited more strictly', 'It shows the share price'],
                answer: 1,
                why: 'Revenue recognition, depreciation and provisions are all judgements. Money in the bank is not, which makes this the statement hardest to shape.',
            },
        ],
    },

    {
        slug: 'quality-of-earnings',
        title: 'Quality of earnings: when profit is not money',
        track: 'company',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Detect the gap between reported profit and cash generated, and name its usual causes.',
        where: { href: '/research', label: 'Back to Research' },
        visual: {
            kind: 'two-series',
            caption: "Profits rose 40%; cash did not move. The gap is sitting in receivables and inventory.",
            a: "reported profit",
            b: "operating cash flow",
            seriesA: [100, 112, 126, 140],
            seriesB: [100, 101, 99, 102],
        },
        prereq: ['cash-flow-statement'],
        concept: [
            'Two companies can report identical net income while one is thriving and the other is failing. The difference is **earnings quality**: how much of the reported profit turned into cash.',
            'The check takes one minute. **Compare cumulative operating cash flow to cumulative net income over three to five years.** For a healthy business they track closely. A company reporting rising profits while operating cash flow stagnates is telling you something the profit line is not.',
            'Where does the profit go? Three places, and each has a benign and a malignant reading.',
            '**Receivables growing faster than revenue.** Benign: sales are growing and collection lags. Malignant: sales are being booked to customers who will not pay, or on terms so generous they are effectively lending. Compute days sales outstanding across years — if it is climbing steadily, the company is financing its own customers.',
            '**Inventory growing faster than revenue.** Benign: stocking up ahead of demand. Malignant: goods are not selling and a write-down is coming. Unsold inventory sits on the balance sheet at cost until someone admits it is worth less.',
            '**Capitalising costs rather than expensing them.** An expense hits profit today; a capitalised cost becomes an asset and hits profit slowly over years. The rules allow this for genuine long-lived assets, and the boundary is a matter of judgement. A company whose capitalised development costs grow much faster than revenue is worth a closer look.',
            'None of these is proof of anything. All three are questions worth asking, and a company that answers them clearly in its filing is a different proposition from one that does not address them at all.',
        ],
        inApp: 'This lesson has no in-app exercise — the app has no company financials. It is the analysis you do before deciding an instrument deserves a position at all.',
        formulas: [
            {
                label: 'The one-minute quality check',
                expr: 'cash conversion = Σ operating cash flow ÷ Σ net income,  over 3-5 years',
                terms: [{ sym: 'Σ', meaning: 'summed across years — one year is noise, five is a pattern' }],
                worked: () => 'Five years of profit totalling 500 against operating cash of 200 means 60% of reported profit never arrived as money.',
            },
        ],
        quiz: [
            {
                question: 'Profits rose 40% over three years while operating cash flow was flat. What should you check first?',
                options: ['The share price', 'Receivables and inventory against revenue growth', 'The dividend', 'The auditor'],
                answer: 1,
                why: 'Profit that has not become cash is usually sitting in receivables or inventory. Days sales outstanding across years shows whether the company is financing its own customers.',
            },
            {
                question: 'What does capitalising a cost do to this year\'s profit?',
                options: ['Reduces it', 'Increases it — the cost becomes an asset and is charged slowly over later years', 'No effect', 'Doubles it'],
                answer: 1,
                why: 'Expensing hits profit now; capitalising defers it. The rules permit it for genuine long-lived assets, which makes the boundary a judgement worth examining.',
            },
        ],
    },

    {
        slug: 'roe-and-roce',
        title: 'ROE, ROCE, and how leverage flatters a ratio',
        track: 'company',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Decompose ROE and explain why a high one can be a warning rather than a compliment.',
        where: { href: '/research', label: 'Look up a real ROE' },
        visual: {
            kind: 'split-bar',
            caption: "DuPont: only one of these three terms is about the business. The third is leverage.",
            steps: [
                { label: "net margin", note: "profitability", tone: 'up', value: 33 },
                { label: "asset turnover", note: "efficiency", tone: 'accent', value: 33 },
                { label: "equity multiplier", note: "leverage, and nothing else", tone: 'down', value: 34 },
            ],
        },
        prereq: ['balance-sheet'],
        concept: [
            '**Return on equity** is net income divided by shareholders\' equity: what the business earns on the owners\' money. It is the most quoted quality ratio and the most misread.',
            'The DuPont decomposition shows why. **ROE = net margin × asset turnover × equity multiplier.** The first is profitability, the second is efficiency, and **the third is simply leverage** — assets divided by equity.',
            'So ROE rises when a company becomes more profitable, more efficient, *or more indebted*. Borrow to buy back shares and equity shrinks while profit does not: ROE rises with nothing about the business having improved. A 40% ROE built on the third term is fragile in exactly the way the first two are not.',
            '**Return on capital employed** fixes this by measuring operating profit against all the capital in the business — debt and equity together. It asks what the assets earn regardless of who funded them, so it cannot be inflated by borrowing.',
            'Read them as a pair. **High ROE with high ROCE** is a genuinely good business. **High ROE with mediocre ROCE** is a leveraged one, and the gap between them is the leverage.',
            'One more comparison decides whether growth creates value at all: **ROCE against the cost of capital.** A company earning 8% on capital that costs 12% destroys value with every rupee it reinvests — and it will still report growing profits while doing so. Growth is only good news when the return on the capital funding it exceeds the price of that capital.',
            'Finally, the denominator can be distorted. Sustained buybacks or accumulated losses shrink equity, and a very small equity base produces spectacular ROE that means nothing.',
        ],
        inApp: '[Research](/research) returns real ROE for US symbols from Finnhub. Apple\'s exceeds 100% — worth understanding as a case where large buybacks have shrunk the equity base, not as a sign the business earns more than it employs.',
        formulas: [
            {
                label: 'DuPont',
                expr: 'ROE = (net income ÷ revenue) × (revenue ÷ assets) × (assets ÷ equity)',
                terms: [
                    { sym: 'term 1', meaning: 'net margin — profitability' },
                    { sym: 'term 2', meaning: 'asset turnover — efficiency' },
                    { sym: 'term 3', meaning: 'equity multiplier — leverage, and nothing else' },
                ],
                worked: () => 'Margin 10%, turnover 1.0, multiplier 1.5 → ROE 15%. Double the leverage to 3.0 and ROE hits 30% with the business unchanged.',
            },
        ],
        quiz: [
            {
                question: 'A company\'s ROE doubles after a debt-funded buyback. What improved?',
                options: ['Profitability', 'Efficiency', 'Nothing about the business — equity shrank, which is the leverage term', 'Asset quality'],
                answer: 2,
                why: 'The equity multiplier is pure leverage. ROCE, which measures operating profit against all capital, would not move — which is exactly why you read the pair.',
            },
            {
                question: 'A company earns 8% on capital that costs 12%. What does growth do?',
                options: ['Creates value', 'Destroys value with every rupee reinvested — while still reporting rising profits', 'Is neutral', 'Reduces risk'],
                answer: 1,
                why: 'Reinvesting below the cost of capital destroys value even as reported profits grow. Growth is only good news when return exceeds the cost of the capital funding it.',
            },
        ],
    },

    {
        slug: 'margins-and-moats',
        title: 'Margins, operating leverage and why they persist',
        track: 'company',
        level: 'advanced',
        kind: 'study',
        minutes: 8,
        outcome: 'Read a margin trend as evidence about competition, and predict how profit responds to a sales change.',
        where: { href: '/research', label: 'Compare margins in one industry' },
        visual: {
            kind: 'two-series',
            caption: "Operating leverage. A 10% revenue swing becomes a 70% profit swing, because fixed costs do not move.",
            a: "revenue",
            b: "profit",
            seriesA: [900, 950, 1000, 1050, 1100],
            seriesB: [30, 65, 100, 135, 170],
        },
        prereq: ['income-statement'],
        concept: [
            'A margin is a ratio, but a **margin trend across years** is evidence about competition. Sustained high margins mean customers keep paying more than the product costs, and competitors have not been able to undercut it. Something is stopping them, and identifying that something is most of the analysis.',
            'The usual candidates: a brand customers will pay extra for, a cost advantage from scale, switching costs that make leaving painful, a network that gets more valuable as it grows, or a licence competitors cannot obtain. Where none of these applies, high margins are usually temporary — capital arrives and competes them away.',
            'Compare margins **within an industry only**. Software margins and grocery margins measure different physics, not different quality of management. A 4% net margin is excellent for a supermarket and catastrophic for a software company.',
            '**Operating leverage** is the other half. Costs split into fixed — rent, salaries, depreciation, which do not move with sales — and variable, which do. The higher the fixed share, the more violently profit responds to a change in revenue.',
            'Work it through, because the asymmetry surprises people. Revenue 1000, fixed costs 600, variable 300, profit 100. Revenue rises 10% to 1100: variable costs rise to 330, fixed stay at 600, **profit goes from 100 to 170 — a 70% increase from a 10% revenue rise.** Now revenue falls 10% instead: profit drops to 30, a 70% decline.',
            'This is why cyclical, capital-heavy businesses swing so hard, and why the same operating leverage that makes a good year spectacular makes a mild downturn existential. It is not a property of good or bad companies — it is a property of the cost structure, and it is readable in advance.',
        ],
        inApp: '[Research](/research) reports gross, operating and net margin for US symbols. The useful exercise is comparing three companies in the same industry, not one company against a general benchmark.',
        formulas: [
            {
                label: 'Operating leverage',
                expr: 'profit = revenue − fixed costs − (variable rate × revenue)',
                terms: [{ sym: 'fixed', meaning: 'costs that do not move with sales — the source of the amplification' }],
                worked: () => 'Fixed 600, variable 30% of revenue. At revenue 1000 profit is 100; at 1100 it is 170; at 900 it is 30. A ±10% revenue swing becomes a ±70% profit swing.',
            },
        ],
        quiz: [
            {
                question: 'Sustained high margins over a decade are evidence of what?',
                options: ['Good luck', 'Something preventing competitors from undercutting — the analysis is identifying what', 'Aggressive accounting', 'A large market'],
                answer: 1,
                why: 'Capital chases high returns. Margins that survive a decade mean something blocks entry — brand, scale, switching costs, network effects or a licence.',
            },
            {
                question: 'A business with high fixed costs sees revenue fall 10%. What happens to profit?',
                options: ['Falls about 10%', 'Falls far more than 10% — fixed costs do not shrink with sales', 'Is unchanged', 'Rises'],
                answer: 1,
                why: 'Operating leverage amplifies in both directions. The cost structure that makes a good year spectacular makes a mild downturn dangerous.',
            },
        ],
    },

    {
        slug: 'valuation-multiples',
        title: 'Multiples: what a P/E is really saying',
        track: 'company',
        level: 'advanced',
        kind: 'study',
        minutes: 9,
        outcome: 'Use a multiple as a compressed assumption rather than a verdict, and pick the right one.',
        where: { href: '/research', label: 'Look up a real P/E' },
        visual: {
            kind: 'gauge',
            caption: "A multiple is not a verdict. It is a compressed claim about growth that you have to judge.",
            value: 0.62,
            a: "cheap \u2014 or earnings about to fall",
            b: "expensive \u2014 or growth to come",
            unit: "\u00d7 P/E",
        },
        prereq: ['roe-and-roce'],
        concept: [
            'A **price-to-earnings ratio** is the price divided by earnings per share. A P/E of 25 means you are paying 25 rupees for each rupee of annual profit. Inverted, it is an earnings yield of 4%.',
            'The essential reframing: **a multiple is not a measure of value, it is a compressed statement of what the market assumes** about growth, durability and risk. A P/E of 40 is not "expensive" — it is a claim that earnings will grow fast enough to justify it. Your job is to decide whether that claim is plausible, not whether the number is large.',
            'This is why low P/Es are so often traps. A stock at 6× is cheap only if earnings hold. Cyclical businesses reach their **lowest** P/E at peak earnings, right before the cycle turns — the ratio looks cheapest at the worst possible moment to buy.',
            'Which multiple to use depends on what you are comparing. **P/E** is distorted by leverage and tax, so it compares poorly across capital structures. **EV/EBITDA** uses enterprise value — market cap plus net debt — against pre-interest, pre-tax profit, so it compares two companies independently of how each is financed. That makes it the better tool when debt levels differ, with the standing caveat that EBITDA ignores real capital costs.',
            '**Price-to-book** compares price to accounting net worth, and is meaningful mainly for banks and financials, where the balance sheet *is* the business. For a software company whose main assets are people and code, book value measures very little.',
            'Two disciplines make multiples useful rather than decorative. Compare **like with like** — same industry, similar growth and leverage. And know **what earnings you are dividing by**: trailing twelve months is history, forward is an estimate, and "adjusted" is whatever the company chose to exclude.',
        ],
        inApp: '[Research](/research) shows real trailing P/E for US symbols. **No free API provides Indian fundamentals** — Alpha Vantage returns an empty object for NSE symbols — so Indian P/Es have to be computed by hand from the filing.',
        formulas: [
            {
                label: 'Three multiples',
                expr: 'P/E = price ÷ EPS    ·    EV/EBITDA = (market cap + net debt) ÷ EBITDA    ·    P/B = price ÷ book value per share',
                terms: [{ sym: 'EV', meaning: 'what it would cost to buy the whole company, debt included' }],
                worked: () => 'A P/E of 25 is an earnings yield of 4%. Whether that is attractive depends entirely on what those earnings do next.',
            },
        ],
        quiz: [
            {
                question: 'A cyclical company trades at a P/E of 6. What is the most likely explanation?',
                options: ['It is a bargain', 'Earnings are at a cyclical peak and expected to fall — the ratio looks cheapest at the worst moment', 'Accounting fraud', 'It pays no dividend'],
                answer: 1,
                why: 'Cyclicals reach their lowest P/E at peak earnings. The denominator is about to fall, which is why a low P/E on a cyclical is a warning rather than a discount.',
            },
            {
                question: 'Why prefer EV/EBITDA to P/E when comparing two companies?',
                options: ['It is always lower', 'It is independent of capital structure and tax, so leverage differences do not distort it', 'It includes dividends', 'It is more accurate'],
                answer: 1,
                why: 'P/E is measured after interest and tax, so a heavily indebted company is not comparable to a debt-free one. EV/EBITDA compares the businesses rather than the financing.',
            },
        ],
    },

    {
        slug: 'dcf-intuition',
        title: 'Discounted cash flow, without the spreadsheet',
        track: 'company',
        level: 'expert',
        kind: 'study',
        minutes: 10,
        outcome: 'Explain what a valuation model actually asserts, and why most of the answer sits in assumptions.',
        where: { href: '/portfolio', label: 'Think about long-run compounding' },
        visual: {
            kind: 'split-bar',
            caption: "Most of a DCF is the part beyond the forecast, computed from a growth rate assumed to hold forever.",
            steps: [
                { label: "years 1\u20135", note: "the part you actually modelled", tone: 'accent', value: 30 },
                { label: "terminal value", note: "a guess, and most of the answer", tone: 'down', value: 70 },
            ],
        },
        prereq: ['valuation-multiples'],
        concept: [
            'A **discounted cash flow** model says something simple: a business is worth the cash it will produce for its owners, with future cash counted for less than cash today.',
            'The discounting is not a convention. A rupee next year is worth less than a rupee now because you could have invested it, and because next year\'s rupee might not arrive. The **discount rate** bundles both — the return available elsewhere, plus compensation for this business\'s uncertainty. Riskier business, higher rate, lower value.',
            'Mechanically: project free cash flow for some years, divide each year by `(1 + r)^n`, add a **terminal value** for everything after the projection ends, and sum.',
            'Now the part that matters more than the mechanics. **In a typical DCF, the majority of the calculated value comes from the terminal value** — the part beyond the forecast horizon, computed from a growth rate assumed to hold forever. So most of the answer rests on two numbers that are guesses: the perpetual growth rate and the discount rate.',
            'Those two are also brutally sensitive. Move the discount rate by one percentage point, or perpetual growth by one, and the valuation can shift by a third or more. This means a DCF **cannot be more precise than its assumptions**, and a model producing "₹1,847 fair value" is displaying false precision — the honest output is a range.',
            'The failure mode is well known and worth naming: it is easy to start from a target price and reverse-engineer the assumptions that produce it. That is not analysis, it is arithmetic in service of a conclusion already reached.',
            'The genuinely useful way to use a DCF is **backwards**. Rather than computing what a company is worth, take the current price and solve for the growth rate it implies. Then ask whether that growth is plausible. "This price requires 25% growth for a decade" is a far more answerable question than "what is this worth", and it puts the burden on evidence rather than on your spreadsheet.',
        ],
        inApp: 'Nothing here is computed by the app. It is the reasoning behind whether an instrument belongs in your book — the decision this simulator lets you practise the consequences of.',
        formulas: [
            {
                label: 'Present value',
                expr: 'PV = Σ  FCF_n ÷ (1 + r)^n    +    terminal value ÷ (1 + r)^N',
                terms: [
                    { sym: 'r', meaning: 'discount rate — opportunity cost plus risk' },
                    { sym: 'terminal value', meaning: 'everything after the forecast, usually most of the answer' },
                ],
                worked: () => '100 received in 5 years at a 12% discount rate is worth 100 ÷ 1.12^5 ≈ 57 today.',
            },
        ],
        quiz: [
            {
                question: 'In a typical DCF, where does most of the calculated value come from?',
                options: ['The first year', 'The explicit forecast period', 'The terminal value — computed from an assumed perpetual growth rate', 'The discount rate'],
                answer: 2,
                why: 'The majority usually sits beyond the forecast horizon, resting on a growth rate assumed to hold forever. That is why DCF output is a range, not a number like ₹1,847.',
            },
            {
                question: 'What is the most useful way to use a DCF?',
                options: ['Compute a precise fair value', 'Run it backwards — solve for the growth the current price implies, then judge whether that is plausible', 'Compare to the P/E', 'Set a stop-loss'],
                answer: 1,
                why: 'Reverse-engineering the market\'s implied assumptions asks an answerable question and puts the burden on evidence, rather than on assumptions you chose.',
            },
        ],
    },

    {
        slug: 'accounting-red-flags',
        title: 'Red flags: what to check before you trust the numbers',
        track: 'company',
        level: 'expert',
        kind: 'study',
        minutes: 10,
        outcome: 'Run a governance and accounting checklist that has preceded most major corporate failures.',
        where: { href: '/research', label: 'Back to Research' },
        visual: {
            kind: 'ladder',
            caption: "Any one is a question. Several together, in a company that will not answer them, is the exit.",
            steps: [
                { label: "auditor resigned", note: "the highest-value single signal", tone: 'down', value: 100 },
                { label: "promoter pledging", note: "a decline becomes forced selling", tone: 'down', value: 80 },
                { label: "profit without cash", note: "it is in receivables", tone: 'warn', value: 70 },
                { label: "related-party flows", note: "money going out to insiders", tone: 'warn', value: 60 },
                { label: "raising equity while profitable", note: "why does it need more?", tone: 'warn', value: 45 },
            ],
        },
        prereq: ['quality-of-earnings'],
        concept: [
            'Most large corporate failures were visible in the filings before they were visible in the price. Not certain — visible. The signals below recur across cases, and none requires special access.',
            '**Auditor changes and qualified opinions.** An auditor resigning mid-term, being replaced by a smaller firm, or issuing anything other than a clean opinion is the single highest-value signal available, because the auditor had access you do not and chose to act on it.',
            '**Promoter pledging.** In Indian companies, promoters pledging their shares as loan collateral is disclosed and is a compounding risk: if the price falls, lenders sell the pledged shares, which pushes the price down further, which triggers more selling. Heavy pledging turns an ordinary decline into a cascade.',
            '**Related-party transactions.** Money moving between the company and entities its promoters control. Some are routine and disclosed; the concern is scale and direction. Cash flowing consistently *out* to related parties is worth understanding in detail.',
            '**Profit without cash.** Covered in the quality lesson and worth repeating, because it appears in nearly every case: rising profits alongside flat operating cash flow.',
            '**Frequent equity raising by a profitable company.** If the business genuinely generates cash, why does it keep needing more?',
            '**Complexity without reason.** Dozens of subsidiaries, opaque intra-group structures, frequent restructuring. Complexity is sometimes necessary and is always where things can be hidden.',
            '**Aggressive revenue recognition** — booking revenue on long contracts far ahead of delivery — and **round-number precision** in reported figures, where results land exactly on guidance quarter after quarter. Real businesses are lumpy.',
            'A caution to hold alongside all of it: **none of these proves fraud, and applied carelessly they will scare you out of good companies.** Any one flag is a question. Several together, in a company you cannot get a straight answer from, is a reason to walk away — and walking away costs you nothing but an opportunity.',
        ],
        inApp: 'This app models market risk, not company risk. A position can be sized perfectly and still go to zero on something that was disclosed in a filing nobody read.',
        quiz: [
            {
                question: 'Which single signal carries the most weight?',
                options: ['A falling share price', 'An auditor resigning or issuing a qualified opinion', 'Missing an earnings estimate', 'A high P/E'],
                answer: 1,
                why: 'The auditor had access to the books that you do not, and acted on what they saw. Nothing else on the list comes with that level of inside knowledge behind it.',
            },
            {
                question: 'Why is heavy promoter pledging dangerous beyond the leverage itself?',
                options: ['It is illegal', 'A price fall triggers lender selling, which drives the price lower and triggers more selling', 'It reduces dividends', 'It dilutes shareholders'],
                answer: 1,
                why: 'The feedback loop is what makes it dangerous. An ordinary decline becomes a cascade, and the selling is forced rather than chosen.',
            },
            {
                question: 'You find one red flag in a company you like. What follows?',
                options: ['Sell immediately', 'It is a question to answer, not a verdict — several together with no straight answers is the exit signal', 'Ignore it', 'It proves fraud'],
                answer: 1,
                why: 'Applied carelessly this checklist will scare you out of good companies. One flag is a question; a cluster you cannot get answered is a reason to walk away.',
            },
        ],
    },
];
