import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { type Candle } from '@/lib/mockData';
import { fetchCandles } from '@/lib/marketData/router';
import { resolveOne, type InstrumentHint } from '@/lib/marketData/universe';

// Historical OHLCV for the backtester and for seeding rolling indicators.
//
// Real data where a provider covers the instrument; a clearly LABELLED synthetic
// series otherwise. The backtester must never present generated data as a historical
// result — the previous generator baked in a positive drift that made a long-only
// strategy essentially unable to lose.

export const runtime = 'nodejs';

export type CandleSource = 'binance' | 'yahoo' | 'finnhub' | 'synthetic';

/** Supported intervals and their bar length in seconds. */
const INTERVALS: Record<string, { seconds: number }> = {
    '1m': { seconds: 60 },
    '5m': { seconds: 300 },
    '15m': { seconds: 900 },
    '1h': { seconds: 3600 },
    '4h': { seconds: 14400 },
    '1d': { seconds: 86400 },
};

/**
 * Geometric Brownian motion with NO baked-in drift.
 *
 * Volatility is ANNUALISED per market and scaled down to the bar interval. The
 * previous version used `0.012 * sqrt(seconds/900)`, which at 1D is 11.8% PER BAR —
 * a 64-bar chart of RELIANCE (~2,944) rendered an axis of 1,217 to 8,699.
 *
 * Intraday bars scale by SESSION seconds, not wall-clock, so a 15-minute equity bar
 * isn't diluted by the 17.5 hours the exchange is shut.
 */
const ANNUAL_VOL: Record<string, number> = {
    crypto: 0.6,
    us: 0.25,
    india: 0.22,
    forex: 0.08,
    commodity: 0.2,
};
const TRADING_DAYS: Record<string, number> = { crypto: 365, us: 252, india: 252, forex: 260, commodity: 252 };
const SESSION_SECONDS: Record<string, number> = { crypto: 86400, us: 23400, india: 22500, forex: 86400, commodity: 82800 };

function perBarVolatility(market: string, seconds: number): number {
    const vol = ANNUAL_VOL[market] ?? 0.25;
    const days = TRADING_DAYS[market] ?? 252;
    if (seconds >= 86400) return vol * Math.sqrt(seconds / 86400 / days);
    return vol * Math.sqrt(seconds / (days * (SESSION_SECONDS[market] ?? 23400)));
}

function synthetic(market: string, base: number, seconds: number, count: number, seed: number, asOf: number): Candle[] {
    const perBarVol = perBarVolatility(market, seconds);
    let s = (Math.abs(Math.floor(seed)) % 2147483647) || 7;
    const rnd = () => ((s = (s * 48271) % 2147483647), s / 2147483647);
    const gauss = () => {
        const u = Math.max(1e-9, rnd());
        const v = rnd();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const out: Candle[] = [];
    let price = base;
    const startTime = asOf - count * seconds;
    for (let i = 0; i < count; i++) {
        const open = price;
        price = Math.max(base * 0.05, price * Math.exp(perBarVol * gauss() - 0.5 * perBarVol * perBarVol));
        const close = price;
        const wick = Math.abs(close - open) * (0.4 + rnd());
        out.push({
            time: startTime + i * seconds,
            open,
            close,
            high: Math.max(open, close) + wick,
            low: Math.max(0.0001, Math.min(open, close) - wick),
        });
    }
    return out;
}

export async function GET(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol') ?? '';
    const interval = url.searchParams.get('interval') ?? '15m';
    const limit = Math.min(5000, Math.max(50, Number(url.searchParams.get('limit') ?? 1000)));
    const seed = Number(url.searchParams.get('seed') ?? 1);

    // The instrument registry is client-only, so a user-added symbol is unknown to this
    // process. The client supplies its descriptor; a hint can never override a seed.
    const market = url.searchParams.get('market');
    const quoteCcy = url.searchParams.get('quoteCcy');
    const hintPrice = Number(url.searchParams.get('price'));
    const hint: InstrumentHint | undefined =
        market && quoteCcy
            ? { symbol, market, quoteCcy, price: Number.isFinite(hintPrice) ? hintPrice : undefined }
            : undefined;

    const asset = resolveOne(symbol, hint);
    if (!asset) return NextResponse.json({ error: 'unknown symbol' }, { status: 400 });
    const spec = INTERVALS[interval];
    if (!spec) return NextResponse.json({ error: 'unsupported interval' }, { status: 400 });

    let candles: Candle[] | null = null;
    let source: CandleSource = 'synthetic';
    let delayMinutes = 0;

    const routed = await fetchCandles(asset, interval, limit);
    if (routed?.candles.length) {
        candles = routed.candles;
        source = routed.provider as CandleSource;
        delayMinutes = routed.delayMinutes;
    }

    if (!candles?.length) {
        // Deterministic given (symbol, seed): no Date.now() inside the generator.
        const asOf = Math.floor(Date.UTC(2026, 7, 10) / 1000);
        // A user-added instrument has no seed price; the client passes its last known
        // one. Without this the fallback series was a flat ₹100 base at US volatility.
        const base = asset.price && asset.price > 0 ? asset.price : 100;
        candles = synthetic(asset.market, base, spec.seconds, Math.min(limit, 1500), seed, asOf);
        source = 'synthetic';
    }

    const body = {
        symbol,
        interval,
        source,
        /** True when the series is generated, so the UI must label the run. */
        synthetic: source === 'synthetic',
        seconds: spec.seconds,
        delayMinutes,
        candles,
    };
    return NextResponse.json(body);
}
