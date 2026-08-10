import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { fetchQuotes } from '@/lib/marketData/router';
import { usdInr } from '@/lib/marketData/providers/fx';
import { WATCHLIST_ASSETS } from '@/lib/mockData';

// Live quotes for every market, via the provider router.
//
// Replaces a direct Twelve Data call that was polled every 15s — 5,760 req/day
// against an 800/day free tier — and only ever backed off when the provider was
// unconfigured, never on a 429.

export const runtime = 'nodejs';

export async function GET(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const requested = url.searchParams.get('symbols');
    const symbols = requested ? requested.split(',') : WATCHLIST_ASSETS.map((a) => a.symbol);

    const [batch, fx] = await Promise.all([fetchQuotes(symbols), usdInr()]);

    return NextResponse.json({
        configured: true,
        quotes: batch.quotes,
        // Per-market provenance: the UI must be able to say "India is 15 min delayed"
        // rather than showing one global LIVE badge over four different feeds.
        status: batch.status,
        fx: { usdInr: fx.rate, source: fx.source, at: fx.at },
    });
}
