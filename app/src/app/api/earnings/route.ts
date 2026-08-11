import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { earningsCalendar, epsSurprisePct, finnhubEarningsConfigured } from '@/lib/marketData/providers/finnhubEarnings';

// Earnings calendar with actual-versus-estimate EPS.
//
// This is what makes the post-earnings-drift strategy possible rather than an
// approximation: a real surprise, not a price gap standing in for one.

export const runtime = 'nodejs';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** A wide window returns thousands of rows; two months is plenty for any screen here. */
const MAX_DAYS = 62;

export async function GET(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    const symbol = url.searchParams.get('symbol')?.trim() || undefined;

    if (!ISO.test(from) || !ISO.test(to)) {
        return NextResponse.json({ error: 'from and to must be YYYY-MM-DD' }, { status: 400 });
    }
    const span = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    if (!(span >= 0) || span > MAX_DAYS) {
        return NextResponse.json({ error: `window must be between 0 and ${MAX_DAYS} days` }, { status: 400 });
    }

    if (!finnhubEarningsConfigured()) {
        return NextResponse.json({ configured: false, reason: 'FINNHUB_API_KEY is not set.', events: [] });
    }

    const events = await earningsCalendar(from, to, symbol);
    return NextResponse.json({
        configured: true,
        events: (events ?? []).map((e) => ({ ...e, surprisePct: epsSurprisePct(e) })),
        at: Date.now(),
    });
}
