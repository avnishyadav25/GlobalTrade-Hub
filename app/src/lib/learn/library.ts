import { LESSONS } from './curriculum';
import type { Resource } from './types';

/**
 * The resource library.
 *
 * Two sources feed it: every `resources` entry attached to a lesson, and the curated
 * pool below. They are merged and de-duplicated so a link cited by three lessons
 * appears once, carrying the lessons that cite it.
 *
 * RULE: every URL in here has been fetched and confirmed reachable. Anything that
 * could not be confirmed was dropped rather than shipped — that is how Investopedia
 * and BabyPips left this list, both returning 402/403 with no way to verify them.
 *
 * Books deliberately carry NO url. A citation cannot rot, and a bookshop link is an
 * affiliate decision rather than a reference.
 */

export type Region = 'india' | 'us' | 'global';

export interface LibraryItem {
    id: string;
    title: string;
    by?: string;
    kind: Resource['kind'];
    url?: string;
    region: Region;
    /** Roughly where in the course this is useful. */
    level: 'foundation' | 'intermediate' | 'advanced' | 'expert';
    topics: string[];
    why: string;
    /** Filled in by `libraryItems()` — lesson slugs that cite this. */
    citedBy?: string[];
}

/** Curated additions that no single lesson cites directly. */
const CURATED: LibraryItem[] = [
    // ---------------------------------------------------------------- foundations
    {
        id: 'varsity',
        title: 'Zerodha Varsity',
        kind: 'course',
        url: 'https://zerodha.com/varsity/',
        region: 'india',
        level: 'foundation',
        topics: ['markets', 'india-equity', 'technical', 'derivatives', 'risk'],
        why: 'The most complete free course written for the Indian market, and kept current across budget changes. If you read one thing, read this.',
    },
    {
        id: 'sebi-investor',
        title: 'SEBI investor education',
        kind: 'regulator',
        url: 'https://investor.sebi.gov.in/',
        region: 'india',
        level: 'foundation',
        topics: ['india-equity', 'risk', 'derivatives'],
        why: 'The regulator\'s own material, the register of intermediaries, its published research on retail outcomes, and where to file a complaint.',
    },
    {
        id: 'rbi',
        title: 'Reserve Bank of India',
        kind: 'regulator',
        url: 'https://www.rbi.org.in/',
        region: 'india',
        level: 'intermediate',
        topics: ['forex', 'macro'],
        why: 'Policy statements, the FEMA position on forex, and the alert list of entities not authorised to deal in foreign exchange.',
    },
    {
        id: 'sec-edgar',
        title: 'SEC EDGAR full-text search',
        kind: 'regulator',
        url: 'https://www.sec.gov/edgar/search/',
        region: 'us',
        level: 'intermediate',
        topics: ['us-equity', 'company'],
        why: 'Every filing by every listed US company, free and searchable. Read the 10-K, not the article about it.',
    },

    // ---------------------------------------------------------------------- books
    {
        id: 'bogle-common-sense',
        title: 'The Little Book of Common Sense Investing',
        by: 'John C. Bogle',
        kind: 'book',
        region: 'global',
        level: 'foundation',
        topics: ['other-markets', 'strategy'],
        why: 'The index-fund argument from the person who built the first one. Short, and it makes the arithmetic unavoidable.',
    },
    {
        id: 'malkiel-random-walk',
        title: 'A Random Walk Down Wall Street',
        by: 'Burton Malkiel',
        kind: 'book',
        region: 'global',
        level: 'foundation',
        topics: ['markets', 'technical', 'strategy'],
        why: 'The case that most patterns are noise, argued carefully enough that it is worth reading even if you disagree.',
    },
    {
        id: 'housel-psychology',
        title: 'The Psychology of Money',
        by: 'Morgan Housel',
        kind: 'book',
        region: 'global',
        level: 'foundation',
        topics: ['risk'],
        why: 'Why sensible people make poor financial decisions. The most readable book on this list.',
    },
    {
        id: 'halan-lets-talk-money',
        title: 'Let\'s Talk Money',
        by: 'Monika Halan',
        kind: 'book',
        region: 'india',
        level: 'foundation',
        topics: ['other-markets', 'risk'],
        why: 'Personal finance written for Indian households — insurance, funds, and the products sold hardest.',
    },
    {
        id: 'graham-intelligent-investor',
        title: 'The Intelligent Investor',
        by: 'Benjamin Graham',
        kind: 'book',
        region: 'global',
        level: 'intermediate',
        topics: ['company', 'risk'],
        why: 'The origin of margin of safety and of treating price and value as different things. Dated in its examples, not in its argument.',
    },
    {
        id: 'graham-interpretation',
        title: 'The Interpretation of Financial Statements',
        by: 'Benjamin Graham',
        kind: 'book',
        region: 'global',
        level: 'intermediate',
        topics: ['company'],
        why: 'A short, plain walk through the three statements, line by line.',
    },
    {
        id: 'fisher-common-stocks',
        title: 'Common Stocks and Uncommon Profits',
        by: 'Philip Fisher',
        kind: 'book',
        region: 'global',
        level: 'advanced',
        topics: ['company'],
        why: 'The qualitative half of company analysis — what to ask about a business that the statements do not answer.',
    },
    {
        id: 'mukherjea-coffee-can',
        title: 'Coffee Can Investing',
        by: 'Saurabh Mukherjea',
        kind: 'book',
        region: 'india',
        level: 'advanced',
        topics: ['company', 'india-equity'],
        why: 'Quality investing applied to Indian companies, with the screening criteria stated explicitly enough to argue with.',
    },
    {
        id: 'nair-bulls-bears',
        title: 'Bulls, Bears and Other Beasts',
        by: 'Santosh Nair',
        kind: 'book',
        region: 'india',
        level: 'intermediate',
        topics: ['india-equity', 'risk'],
        why: 'A history of the Indian market\'s booms and scams. Useful context for why the current rules exist.',
    },
    {
        id: 'lefevre-reminiscences',
        title: 'Reminiscences of a Stock Operator',
        by: 'Edwin Lefèvre',
        kind: 'book',
        region: 'global',
        level: 'intermediate',
        topics: ['risk', 'strategy'],
        why: 'A century old and still the best description of what trading does to judgement.',
    },
    {
        id: 'schwager-market-wizards',
        title: 'Market Wizards',
        by: 'Jack Schwager',
        kind: 'book',
        region: 'global',
        level: 'intermediate',
        topics: ['strategy', 'risk'],
        why: 'Interviews with successful traders. Read it aware that it is drawn entirely from the surviving tail.',
    },
    {
        id: 'douglas-trading-zone',
        title: 'Trading in the Zone',
        by: 'Mark Douglas',
        kind: 'book',
        region: 'global',
        level: 'intermediate',
        topics: ['risk'],
        why: 'On executing a plan you already believe in — which is where most systematic traders actually fail.',
    },
    {
        id: 'kahneman-thinking',
        title: 'Thinking, Fast and Slow',
        by: 'Daniel Kahneman',
        kind: 'book',
        region: 'global',
        level: 'advanced',
        topics: ['risk'],
        why: 'The research behind every bias named in the risk track, from the person who did much of it.',
    },
    {
        id: 'taleb-fooled',
        title: 'Fooled by Randomness',
        by: 'Nassim Nicholas Taleb',
        kind: 'book',
        region: 'global',
        level: 'advanced',
        topics: ['risk', 'strategy'],
        why: 'On mistaking luck for skill, which is what a good year of trading feels like from the inside.',
    },
    {
        id: 'bernstein-against-gods',
        title: 'Against the Gods: The Remarkable Story of Risk',
        by: 'Peter L. Bernstein',
        kind: 'book',
        region: 'global',
        level: 'advanced',
        topics: ['risk'],
        why: 'How humanity learned to measure risk at all. Context for why the tools work as well and as badly as they do.',
    },
    {
        id: 'lowenstein-when-genius-failed',
        title: 'When Genius Failed',
        by: 'Roger Lowenstein',
        kind: 'book',
        region: 'global',
        level: 'advanced',
        topics: ['risk', 'strategy'],
        why: 'LTCM: what happens when a correct model meets leverage and a correlation that changed.',
    },
    {
        id: 'lewis-big-short',
        title: 'The Big Short',
        by: 'Michael Lewis',
        kind: 'book',
        region: 'us',
        level: 'intermediate',
        topics: ['macro', 'risk'],
        why: 'How the 2008 crisis was visible in the data before it was visible in prices, and why that was not enough.',
    },
    {
        id: 'hull-derivatives',
        title: 'Options, Futures, and Other Derivatives',
        by: 'John C. Hull',
        kind: 'book',
        region: 'global',
        level: 'expert',
        topics: ['derivatives'],
        why: 'The standard derivatives textbook. Mathematical, and the reference the Greeks lesson compresses.',
    },
    {
        id: 'aronson-evidence-based-ta',
        title: 'Evidence-Based Technical Analysis',
        by: 'David Aronson',
        kind: 'book',
        region: 'global',
        level: 'expert',
        topics: ['technical', 'strategy'],
        why: 'Applies statistical rigour to chart patterns, including the multiple-comparisons problem. The honest companion to the technical track.',
    },
    {
        id: 'chan-quantitative-trading',
        title: 'Quantitative Trading',
        by: 'Ernest P. Chan',
        kind: 'book',
        region: 'global',
        level: 'expert',
        topics: ['strategy'],
        why: 'A practical walk from idea to backtest to live, including the parts that usually go wrong.',
    },
    {
        id: 'lopez-de-prado-afml',
        title: 'Advances in Financial Machine Learning',
        by: 'Marcos López de Prado',
        kind: 'book',
        region: 'global',
        level: 'expert',
        topics: ['strategy'],
        why: 'Rigorous on backtest overfitting and why most published quantitative results do not survive.',
    },
    {
        id: 'antonopoulos-mastering-bitcoin',
        title: 'Mastering Bitcoin',
        by: 'Andreas M. Antonopoulos',
        kind: 'book',
        region: 'global',
        level: 'advanced',
        topics: ['crypto'],
        why: 'How the technology actually works, at the level of someone who wants to verify claims rather than repeat them.',
    },

    // -------------------------------------------------------------------- video
    {
        id: 'yt-zerodha',
        title: 'Zerodha (YouTube)',
        kind: 'video',
        url: 'https://www.youtube.com/@ZerodhaOnline',
        region: 'india',
        level: 'foundation',
        topics: ['india-equity', 'markets'],
        why: 'Indian market mechanics explained by the broker whose documentation this course cites most.',
    },
    {
        id: 'yt-plain-bagel',
        title: 'The Plain Bagel',
        kind: 'video',
        url: 'https://www.youtube.com/@ThePlainBagel',
        region: 'global',
        level: 'foundation',
        topics: ['markets', 'risk', 'other-markets'],
        why: 'Calm, sceptical explanations from a former analyst. Notably good at debunking rather than promoting.',
    },
    {
        id: 'yt-patrick-boyle',
        title: 'Patrick Boyle',
        kind: 'video',
        url: 'https://www.youtube.com/@PatrickBoyle',
        region: 'global',
        level: 'advanced',
        topics: ['derivatives', 'macro', 'strategy'],
        why: 'A former hedge fund manager and finance lecturer on market structure, derivatives and recurring frauds.',
    },
];

/** Fold a lesson `Resource` into a library shape. */
function fromResource(r: Resource, lessonSlug: string, level: LibraryItem['level'], topic: string): LibraryItem {
    return {
        id: r.url ?? `${r.kind}:${r.title}`,
        title: r.title,
        by: r.by,
        kind: r.kind,
        url: r.url,
        region: r.url?.includes('sebi') || r.url?.includes('rbi') || r.url?.includes('zerodha') ? 'india'
             : r.url?.includes('sec.gov') ? 'us' : 'global',
        level,
        topics: [topic],
        why: r.why,
        citedBy: [lessonSlug],
    };
}

/**
 * Everything, merged and de-duplicated.
 *
 * Identity is the URL where one exists and `kind:title` otherwise, so the same link
 * cited by six lessons is one row carrying six citations rather than six rows.
 */
export function libraryItems(): LibraryItem[] {
    const byId = new Map<string, LibraryItem>();

    for (const item of CURATED) byId.set(item.url ?? `${item.kind}:${item.title}`, { ...item });

    for (const lesson of LESSONS) {
        for (const r of lesson.resources ?? []) {
            const item = fromResource(r, lesson.slug, lesson.level, lesson.track);
            const existing = byId.get(item.id);
            if (!existing) {
                byId.set(item.id, item);
                continue;
            }
            existing.citedBy = [...new Set([...(existing.citedBy ?? []), lesson.slug])];
            existing.topics = [...new Set([...existing.topics, lesson.track])];
        }
    }

    return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export const LIBRARY_KINDS: Resource['kind'][] = ['book', 'course', 'video', 'article', 'regulator', 'tool', 'dataset'];
