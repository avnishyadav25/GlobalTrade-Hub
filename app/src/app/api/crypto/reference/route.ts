import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { coinReference, coinIdFor } from '@/lib/marketData/providers/coingecko';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const symbol = (new URL(req.url).searchParams.get('symbol') ?? '').trim();
    if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

    if (!coinIdFor(symbol)) {
        return NextResponse.json({
            supported: false,
            reason: `No CoinGecko mapping for ${symbol}. Reference data covers the seeded crypto instruments only.`,
            data: null,
        });
    }

    return NextResponse.json({ supported: true, data: await coinReference(symbol), at: Date.now() });
}
