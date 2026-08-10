import { NextResponse } from 'next/server';

// FX / commodity (and optionally equity) quotes via a provider (default Twelve Data).
// Server-side so the provider key never reaches the browser. Returns configured:false
// when no key is set, so the client keeps simulating those instruments.

export const runtime = 'nodejs';

export async function GET(req: Request) {
    const key = process.env.MARKETDATA_API_KEY;
    const provider = process.env.MARKETDATA_PROVIDER || 'twelvedata';
    if (!key) return NextResponse.json({ configured: false, quotes: [] });

    const url = new URL(req.url);
    const symbols = (url.searchParams.get('symbols') || 'EUR/USD,GBP/USD,USD/JPY,XAU/USD,XAG/USD,WTI/USD').split(',');

    try {
        if (provider === 'twelvedata') {
            const res = await fetch(`https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbols.join(','))}&apikey=${key}`);
            const data = await res.json();
            const quotes = symbols
                .map((s) => {
                    const node = symbols.length === 1 ? data : data[s];
                    const price = node?.price ? parseFloat(node.price) : null;
                    return price ? { symbol: s, price } : null;
                })
                .filter(Boolean);
            return NextResponse.json({ configured: true, provider, quotes });
        }
        // other providers can be added here (finnhub, alphavantage)
        return NextResponse.json({ configured: false, quotes: [], message: `provider ${provider} not wired` });
    } catch (e) {
        return NextResponse.json({ configured: true, quotes: [], error: String(e) });
    }
}
