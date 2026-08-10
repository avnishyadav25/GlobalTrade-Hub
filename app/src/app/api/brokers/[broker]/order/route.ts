import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getConnector } from '@/lib/brokers/server';
import { readCredentials } from '@/lib/brokers/server/vault';
import { envCredentials, type BrokerMode } from '@/lib/brokers/server/types';

// Live order routing.
//
// SAFETY: real-money routing requires BOTH an explicit mode:'live' from the caller and
// ENABLE_LIVE_TRADING=true on the server. Callers that omit a mode default to paper —
// AgentEngine used to post no mode at all.

export const runtime = 'nodejs';

interface OrderBody {
    symbol?: string;
    side?: 'buy' | 'sell';
    type?: 'market' | 'limit';
    qty?: number;
    limitPrice?: number;
    mode?: BrokerMode;
}

export async function POST(req: Request, { params }: { params: Promise<{ broker: string }> }) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { broker } = await params;

    let body: OrderBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    const connector = getConnector(broker);
    if (!connector) {
        return NextResponse.json(
            { status: 'not_implemented', broker, message: `No server connector for ${broker}. Implemented: Alpaca, Binance, Dhan.` },
            { status: 501 }
        );
    }

    // Default to paper when unspecified — never assume live.
    const mode: BrokerMode = body.mode === 'live' ? 'live' : 'paper';
    if (mode === 'live' && process.env.ENABLE_LIVE_TRADING !== 'true') {
        return NextResponse.json(
            { status: 'blocked', message: 'Live trading is disabled on this server. Set ENABLE_LIVE_TRADING=true to allow real orders.' },
            { status: 403 }
        );
    }
    if (!connector.supports(mode)) {
        return NextResponse.json({ status: 'blocked', message: `${broker} has no ${mode} environment.` }, { status: 400 });
    }

    if (!body.symbol || !body.side || !Number.isFinite(body.qty) || (body.qty as number) <= 0) {
        return NextResponse.json({ status: 'error', message: 'symbol, side and a positive qty are required.' }, { status: 400 });
    }

    // Vault first, then the server env fallback.
    const creds = (await readCredentials(broker, mode)) ?? envCredentials(broker);
    if (!creds) {
        return NextResponse.json(
            { status: 'error', message: `No stored credentials for ${broker} (${mode}). Connect it in Settings first.` },
            { status: 412 }
        );
    }

    const result = await connector.placeOrder(creds, mode, {
        symbol: body.symbol,
        side: body.side,
        type: body.type === 'limit' ? 'limit' : 'market',
        qty: body.qty as number,
        limitPrice: body.limitPrice,
    });

    if (!result.ok) {
        return NextResponse.json({ status: 'error', broker, mode, message: result.reason }, { status: 502 });
    }
    return NextResponse.json({ status: 'ok', broker, mode, orderId: result.brokerOrderId, brokerStatus: result.status });
}
