import { NextResponse } from 'next/server';
import { dailyBriefing } from '@/lib/ai/agents';
import { notify } from '@/lib/notify';
import { WATCHLIST_ASSETS } from '@/lib/mockData';
import { resolveUniverse } from '@/lib/marketData/universe';
import { loadPersistedWatchlist } from '@/lib/marketData/watchlistState';
import { fetchQuotes } from '@/lib/marketData/router';
import { snapshotChains } from '@/lib/options/snapshot';

// Scheduled tick — point Vercel Cron or Supabase pg_cron at
//   GET /api/cron/tick?secret=CRON_SECRET
// Generates the daily briefing and pushes it to the configured notification channels.

export const runtime = 'nodejs';

/**
 * Cap the cron's fan-out. A 200-symbol watchlist would otherwise drain the Yahoo
 * bucket in one burst and trip the circuit breaker for the interactive path.
 */
const CRON_MAX_SYMBOLS = 40;

function authorized(req: Request): boolean {
    const secret = process.env.CRON_SECRET;
    // Open in dev only. In production an unset CRON_SECRET must fail closed rather
    // than exposing an endpoint that runs an LLM agent and sends notifications.
    if (!secret) return process.env.NODE_ENV !== 'production';
    const url = new URL(req.url);
    return url.searchParams.get('secret') === secret || req.headers.get('x-cron-secret') === secret;
}

export async function GET(req: Request) {
    if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    // Cover the user's own instruments, not just the seeded catalog.
    const persisted = await loadPersistedWatchlist();
    const { universe } = persisted
        ? resolveUniverse(persisted.symbols, persisted.hints)
        : resolveUniverse(WATCHLIST_ASSETS.map((a) => a.symbol));

    const batch = await fetchQuotes(universe, { maxSymbols: CRON_MAX_SYMBOLS });

    // This used to hand the LLM the catalog's STATIC seed prices — the daily briefing
    // was generated from mock data and read as though it were market commentary.
    // dailyBriefing() slices to 16, so lead with the biggest movers.
    const market = batch.quotes
        .map((q) => ({
            symbol: q.symbol,
            price: q.price,
            changePercent: q.prevClose ? ((q.price - q.prevClose) / q.prevClose) * 100 : 0,
        }))
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

    if (!market.length) {
        // Say nothing rather than narrate an empty market as if it were calm.
        return NextResponse.json({ ok: false, reason: 'no quotes available', universe: universe.length, sent: [] });
    }

    const brief = await dailyBriefing(market, []);
    const sent = await notify(brief.text, 'GlobalTrade Hub — Daily Briefing');

    // Capture today's option chains. This is the ONLY way real option history ever
    // accumulates — no free source publishes past Indian chains, so a day not captured
    // is a day permanently missing. Failures are reported rather than thrown: a chain
    // NSE refused must not stop the briefing that already succeeded.
    const chains = await snapshotChains(['NIFTY', 'BANKNIFTY'], Date.now()).catch((e) => [
        { symbol: 'NIFTY' as const, expiry: '', strikes: 0, stored: false, reason: e instanceof Error ? e.message : 'snapshot failed' },
    ]);

    return NextResponse.json({
        ok: true,
        source: brief.source,
        universe: persisted ? 'watchlist' : 'seeds',
        symbolCount: market.length,
        sent,
        chains,
    });
}
