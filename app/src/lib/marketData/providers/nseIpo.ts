import 'server-only';
import { cachedFetch } from '../cache';

// Current Indian IPOs, from NSE's public issue endpoint.
//
// NSE blocks most programmatic access — its main site answers 403 to anything that does
// not look like a browser — but this JSON endpoint responds when sent browser headers
// and a referer. Verified live: it returned a real open issue.
//
// It is unofficial and can change without notice, so every failure path returns null
// and the screen says the list is unavailable rather than showing an empty one, which
// would read as "no IPOs are open".

const PROVIDER = 'nse';
const LIMIT = { perMinute: 10 };
const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export interface IpoIssue {
    company: string;
    symbol: string | null;
    /** Issue window, as published. Kept as strings — NSE's format is not ISO. */
    opensOn: string | null;
    closesOn: string | null;
    priceBand: string | null;
    lotSize: number | null;
    issueSize: string | null;
    status: string | null;
}

interface NseRow {
    companyName?: string;
    symbol?: string;
    issueStartDate?: string;
    issueEndDate?: string;
    priceBand?: string;
    minBidQuantity?: string | number;
    issueSize?: string | number;
    status?: string;
    series?: string;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const int = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

export async function currentIpos(): Promise<IpoIssue[] | null> {
    return cachedFetch<IpoIssue[]>(
        // An IPO window changes at most daily; an hour is generous and keeps us well
        // clear of anything NSE would consider abusive.
        { provider: PROVIDER, key: 'ipo:current', ttlMs: 60 * 60_000, limit: LIMIT },
        async () => {
            const res = await fetch('https://www.nseindia.com/api/ipo-current-issue', {
                headers: {
                    'user-agent': UA,
                    accept: 'application/json, text/plain, */*',
                    'accept-language': 'en-US,en;q=0.9',
                    referer: 'https://www.nseindia.com/market-data/all-upcoming-issues-ipo',
                },
                cache: 'no-store',
            });
            if (!res.ok) return null;

            const body: unknown = await res.json();
            if (!Array.isArray(body)) return null;

            const rows = (body as NseRow[])
                .filter((r) => str(r.companyName))
                .map<IpoIssue>((r) => ({
                    company: str(r.companyName) as string,
                    symbol: str(r.symbol),
                    opensOn: str(r.issueStartDate),
                    closesOn: str(r.issueEndDate),
                    priceBand: str(r.priceBand),
                    lotSize: int(r.minBidQuantity),
                    issueSize: str(String(r.issueSize ?? '')) ,
                    status: str(r.status) ?? str(r.series),
                }));

            // An empty array is a valid answer — there genuinely may be no open issue —
            // so it is returned as data rather than treated as a failure.
            return rows;
        }
    );
}
