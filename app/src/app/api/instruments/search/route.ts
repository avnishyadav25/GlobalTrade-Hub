import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { cachedFetch } from '@/lib/marketData/cache';

// Instrument search, proxied through Yahoo's public search endpoint.
// Guarded because it is an unauthenticated third-party call made from our IP.

export const runtime = 'nodejs';

const MARKET_FOR_EXCHANGE: Record<string, { market: string; quoteCcy: string }> = {
    NSI: { market: 'india', quoteCcy: 'INR' },
    BSE: { market: 'india', quoteCcy: 'INR' },
    NMS: { market: 'us', quoteCcy: 'USD' },
    NYQ: { market: 'us', quoteCcy: 'USD' },
    NGM: { market: 'us', quoteCcy: 'USD' },
    PCX: { market: 'us', quoteCcy: 'USD' },
    CCC: { market: 'crypto', quoteCcy: 'USD' },
    CCY: { market: 'forex', quoteCcy: 'USD' },
    CMX: { market: 'commodity', quoteCcy: 'USD' },
    NYM: { market: 'commodity', quoteCcy: 'USD' },
};

interface YahooHit {
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    quoteType?: string;
}

export async function GET(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const q = new URL(req.url).searchParams.get('q')?.trim();
    if (!q || q.length < 2) return NextResponse.json({ results: [] });

    // Yahoo's search endpoint is throttled far more aggressively than its chart
    // endpoint and will 429 an IP quickly, so it is cached, rate-limited and
    // circuit-broken like every other upstream call.
    let data: { quotes?: YahooHit[] } | null = null;
    let limited = false;
    try {
        data = await cachedFetch<{ quotes?: YahooHit[] }>(
            { provider: 'yahoo-search', key: q.toLowerCase(), ttlMs: 10 * 60_000, limit: { perMinute: 8, perDay: 400 } },
            async () => {
                const res = await fetch(
                    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0`,
                    { headers: { 'user-agent': 'Mozilla/5.0 (compatible; GlobalTradeHub/1.0)' }, cache: 'no-store' }
                );
                if (res.status === 429) { limited = true; return null; }
                if (!res.ok) return null;
                return res.json();
            }
        );
    } catch {
        data = null;
    }

    try {
        const results = (data?.quotes ?? [])
            .filter((h: YahooHit) => h.symbol && h.exchange && MARKET_FOR_EXCHANGE[h.exchange])
            .map((h: YahooHit) => {
                const m = MARKET_FOR_EXCHANGE[h.exchange as string];
                return {
                    // The provider symbol IS the app symbol for user-added instruments,
                    // so the Yahoo provider resolves it without another mapping.
                    symbol: h.symbol,
                    name: h.longname ?? h.shortname ?? h.symbol,
                    exchange: h.exchange,
                    market: m.market,
                    quoteCcy: m.quoteCcy,
                    type: h.quoteType,
                };
            });

        if (results.length) return NextResponse.json({ results, source: 'search' });

        // Fallback: treat the query as an exact ticker and resolve it through the
        // chart endpoint, which is rate-limited far more generously. This is what
        // keeps "add TATAMOTORS.NS" working even when search is throttled.
        const direct = await resolveExact(q);
        if (direct) return NextResponse.json({ results: [direct], source: 'exact' });

        return NextResponse.json({
            results: [],
            source: limited ? 'rate-limited' : 'none',
            error: limited
                ? 'Yahoo is rate-limiting instrument search right now. Type the exact ticker instead — e.g. TATAMOTORS.NS, TSLA, BTC-USD.'
                : undefined,
        });
    } catch (e) {
        return NextResponse.json({ results: [], error: e instanceof Error ? e.message : 'search failed' });
    }
}

/** Resolve a literal ticker via the chart endpoint, deriving market from its metadata. */
async function resolveExact(symbol: string) {
    const meta = await cachedFetch<{ currency?: string; exchangeName?: string; instrumentType?: string; longName?: string; shortName?: string; regularMarketPrice?: number } | null>(
        { provider: 'yahoo', key: `resolve:${symbol}`, ttlMs: 10 * 60_000, limit: { perMinute: 30 } },
        async () => {
            const res = await fetch(
                `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
                { headers: { 'user-agent': 'Mozilla/5.0 (compatible; GlobalTradeHub/1.0)' }, cache: 'no-store' }
            );
            if (!res.ok) return null;
            const j = await res.json();
            return j?.chart?.result?.[0]?.meta ?? null;
        }
    );
    if (!meta?.regularMarketPrice) return null;

    const ccy = (meta.currency ?? 'USD').toUpperCase();
    const type = (meta.instrumentType ?? '').toUpperCase();
    const market =
        type === 'CRYPTOCURRENCY' ? 'crypto'
        : type === 'CURRENCY' ? 'forex'
        : type === 'FUTURE' ? 'commodity'
        : ccy === 'INR' ? 'india'
        : 'us';

    return {
        symbol: symbol.toUpperCase(),
        name: meta.longName ?? meta.shortName ?? symbol.toUpperCase(),
        exchange: meta.exchangeName ?? '—',
        market,
        quoteCcy: ccy === 'INR' ? 'INR' : ccy === 'JPY' ? 'JPY' : 'USD',
        price: meta.regularMarketPrice,
    };
}
