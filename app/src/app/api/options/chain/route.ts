import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
    contractInfo,
    optionChain,
    lotSizes,
    lotSizeFor,
    isOptionRoot,
    OPTION_ROOTS,
} from '@/lib/marketData/providers/nseOptionChain';

// Live NSE index option chains.
//
// Three states, kept distinct because collapsing them is how a screen starts lying:
//   supported: false  → this app does not cover that symbol at all
//   available: false  → NSE did not answer. NOT an empty market.
//   strikes: []       → NSE answered and there are genuinely no contracts
//
// The serverless caveat is returned in the payload rather than only living in a comment:
// NSE blocks datacenter egress hard, so this route can work locally and return nothing
// when deployed. A user seeing an empty screen deserves to know which of those it is.

export const runtime = 'nodejs';

const UNREACHABLE =
    'NSE did not answer. This endpoint is unofficial and blocks datacenter IP ranges, so it can work locally and fail when deployed. It is not an empty market.';

export async function GET(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const params = new URL(req.url).searchParams;
    const symbol = (params.get('symbol') ?? 'NIFTY').trim().toUpperCase();
    const expiry = (params.get('expiry') ?? '').trim();

    if (!isOptionRoot(symbol)) {
        return NextResponse.json({
            supported: false,
            reason: `Only index options are covered: ${OPTION_ROOTS.join(', ')}. Stock options settle physically and need a delivery model this app does not have.`,
            data: null,
        });
    }

    const info = await contractInfo(symbol);
    if (!info) return NextResponse.json({ supported: true, available: false, reason: UNREACHABLE, data: null });
    if (!info.data) {
        return NextResponse.json({
            supported: true,
            available: true,
            reason: `NSE lists no current expiries for ${symbol}.`,
            data: null,
        });
    }

    // No expiry asked for — hand back the list so the caller can choose one. Guessing
    // would be wrong: v3 answers 200 with an empty array for an unlisted expiry, which
    // reads as "no contracts" rather than "wrong parameter".
    if (!expiry) {
        return NextResponse.json({
            supported: true,
            available: true,
            expiries: info.data.expiries,
            data: null,
            at: Date.now(),
        });
    }

    if (!info.data.expiries.includes(expiry)) {
        return NextResponse.json({
            supported: true,
            available: true,
            expiries: info.data.expiries,
            reason: `${expiry} is not a listed expiry for ${symbol}.`,
            data: null,
        });
    }

    const [chain, sizes] = await Promise.all([optionChain(symbol, expiry), lotSizes(symbol)]);
    if (!chain) {
        return NextResponse.json({ supported: true, available: false, reason: UNREACHABLE, expiries: info.data.expiries, data: null });
    }

    const lotSize = lotSizeFor(sizes?.data ?? null, expiry);

    return NextResponse.json({
        supported: true,
        available: true,
        expiries: info.data.expiries,
        lotSize,
        // A null lot size is load-bearing: without it an order cannot be sized, so the
        // caller must refuse rather than assume a number.
        lotSizeReason: lotSize === null ? 'NSE\'s contract master could not be read, so no lot size is available. Orders cannot be sized without it.' : null,
        data: chain.data,
        at: Date.now(),
    });
}
