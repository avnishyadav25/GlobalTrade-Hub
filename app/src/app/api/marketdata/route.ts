import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { fetchQuotes } from '@/lib/marketData/router';
import { usdInr } from '@/lib/marketData/providers/fx';
import { resolveUniverse, MAX_REQUESTED, MAX_HINTS, type InstrumentHint } from '@/lib/marketData/universe';
import { WATCHLIST_ASSETS } from '@/lib/mockData';

// Live quotes for every market, via the provider router.
//
// POST, not GET, because the client must send instrument DESCRIPTORS alongside the
// symbols: the instrument registry is client-only, so the server cannot resolve a
// user-added symbol on its own. 120 symbols plus descriptors is several KB, which is
// uncomfortable in a request line against Node's 16 KB header limit and fails as an
// opaque 431. Nothing is lost by moving off GET — all caching here is in-process via
// `cachedFetch`, keyed by provider, and never HTTP-level.
//
// The GET form is kept as a seeds-only debug path.

export const runtime = 'nodejs';

async function respond(symbols: unknown, hints: unknown) {
    const { universe, dropped } = resolveUniverse(symbols, hints);

    // Resolve failures must never blank the board: a single malformed row from a stale
    // localStorage blob would otherwise take out the USD/INR rate that the whole rupee
    // book is converted through.
    const [batch, fx] = await Promise.all([fetchQuotes(universe), usdInr()]);

    return NextResponse.json({
        configured: true,
        quotes: batch.quotes,
        // Per-market provenance: the UI must be able to say "India is 15 min delayed"
        // rather than showing one global LIVE badge over four different feeds.
        status: batch.status,
        fx: { usdInr: fx.rate, source: fx.source, at: fx.at },
        /** Symbols we refused to resolve, with the reason. Never silently dropped. */
        skipped: dropped,
        /** Resolved but not fetched this cycle — the client shows these as queued. */
        deferred: batch.deferred,
        at: Date.now(),
    });
}

export async function POST(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    const { symbols, instruments } = body as { symbols?: unknown; instruments?: unknown };
    if (!Array.isArray(symbols)) {
        return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    if (symbols.length > MAX_REQUESTED) {
        return NextResponse.json({ error: 'too many symbols' }, { status: 400 });
    }
    if (instruments !== undefined && (!Array.isArray(instruments) || instruments.length > MAX_HINTS)) {
        return NextResponse.json({ error: 'too many instruments' }, { status: 400 });
    }

    return respond(symbols, instruments as InstrumentHint[] | undefined);
}

/** Seeds only. Kept for manual probing; the app polls via POST. */
export async function GET(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const requested = new URL(req.url).searchParams.get('symbols');
    const symbols = requested ? requested.split(',') : WATCHLIST_ASSETS.map((a) => a.symbol);
    return respond(symbols, undefined);
}
