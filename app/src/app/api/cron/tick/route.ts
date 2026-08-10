import { NextResponse } from 'next/server';
import { dailyBriefing } from '@/lib/ai/agents';
import { notify } from '@/lib/notify';
import { WATCHLIST_ASSETS } from '@/lib/mockData';

// Scheduled tick — point Vercel Cron or Supabase pg_cron at
//   GET /api/cron/tick?secret=CRON_SECRET
// Generates the daily briefing and pushes it to the configured notification channels.

export const runtime = 'nodejs';

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

    const market = WATCHLIST_ASSETS.map((a) => ({ symbol: a.symbol, price: a.price, changePercent: a.changePercent }));
    const brief = await dailyBriefing(market, []);
    const sent = await notify(brief.text, 'GlobalTrade Hub — Daily Briefing');
    return NextResponse.json({ ok: true, source: brief.source, sent });
}
