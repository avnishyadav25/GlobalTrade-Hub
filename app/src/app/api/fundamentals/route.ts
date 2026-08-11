import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { companyFundamentals, finnhubFundamentalsConfigured } from '@/lib/marketData/providers/finnhubFundamentals';
import { marketOf } from '@/lib/paperEngine';

// Company fundamentals, for the "Reading a company" track.
//
// US listings only. Finnhub's free tier does not cover Indian companies, and no free
// API does — Alpha Vantage returns an empty object for RELIANCE.BSE. The route says so
// explicitly rather than returning nothing and letting the screen imply a lookup failure.

export const runtime = 'nodejs';

export async function GET(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const symbol = (new URL(req.url).searchParams.get('symbol') ?? '').trim();
    if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

    if (!finnhubFundamentalsConfigured()) {
        return NextResponse.json({ configured: false, reason: 'FINNHUB_API_KEY is not set.', data: null });
    }

    // Refuse rather than silently return nothing for a market this provider cannot serve.
    if (marketOf(symbol) !== 'us') {
        return NextResponse.json({
            configured: true,
            unsupported: true,
            reason:
                'Fundamentals are only available for US listings. There is no free API for Indian company financials — the lessons use worked examples from published annual reports instead.',
            data: null,
        });
    }

    const data = await companyFundamentals(symbol);
    return NextResponse.json({ configured: true, unsupported: false, data, at: Date.now() });
}
