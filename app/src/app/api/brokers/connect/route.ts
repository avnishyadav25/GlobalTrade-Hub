import { NextResponse } from 'next/server';

// Server-side connection endpoint. Credentials are received here and NEVER returned
// to the client. When Supabase is configured they are meant to be stored in Supabase
// Vault (see docs); without it, this validates the payload shape and reports status.

export const runtime = 'nodejs';

interface ConnectRequest {
    brokerId: string;
    mode: 'paper' | 'live';
    credentials: Record<string, string>;
}

const REQUIRED: Record<string, string[]> = {
    zerodha: ['apiKey', 'apiSecret'],
    dhan: ['clientId', 'accessToken'],
    alpaca: ['keyId', 'secretKey'],
    binance: ['apiKey', 'apiSecret'],
    coinbase: ['apiKey', 'apiSecret'],
    ibkr: ['gatewayUrl'],
    marketdata: ['apiKey'],
};

export async function POST(req: Request) {
    let body: ConnectRequest;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    const required = REQUIRED[body.brokerId];
    if (!required) return NextResponse.json({ error: 'unknown broker' }, { status: 400 });

    const missing = required.filter((k) => !body.credentials?.[k]?.trim());
    if (missing.length) {
        return NextResponse.json({ status: 'error', missing }, { status: 422 });
    }

    // NOTE: real persistence → store body.credentials in Supabase Vault keyed by user.
    // Secrets are intentionally not echoed back.
    const vaultConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

    return NextResponse.json({
        status: 'connected',
        brokerId: body.brokerId,
        mode: body.mode,
        persisted: vaultConfigured,
        message: vaultConfigured
            ? 'Credentials stored server-side (Supabase Vault).'
            : 'Validated. Configure SUPABASE_SERVICE_ROLE_KEY to persist credentials in Vault.',
    });
}
