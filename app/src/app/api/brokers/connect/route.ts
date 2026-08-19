import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { brokerById } from '@/lib/brokers/registry';
import { getConnector } from '@/lib/brokers/server';
import { envCredentials, type BrokerMode } from '@/lib/brokers/server/types';
import { storeCredentials, recordConnection, listConnections, removeConnection, isVaultConfigured } from '@/lib/brokers/server/vault';

// Broker connection management.
//
// This route used to check that the posted fields were non-empty strings, return
// status:'connected', and then DISCARD the credentials — while telling the user they
// had been "stored server-side (Supabase Vault)" purely because an env var was set.
// It now authenticates against the venue first and only stores on success.

export const runtime = 'nodejs';

interface ConnectRequest {
    brokerId: string;
    mode: BrokerMode;
    credentials?: Record<string, string>;
}

export async function GET(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ configured: isVaultConfigured(), connections: await listConnections() });
}

export async function POST(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    let body: ConnectRequest;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    const def = brokerById(body.brokerId);
    if (!def) return NextResponse.json({ status: 'error', reason: 'Unknown broker.' }, { status: 400 });

    const mode: BrokerMode = body.mode === 'live' ? 'live' : 'paper';
    if (!def.modes.includes(mode)) {
        return NextResponse.json(
            { status: 'error', reason: `${def.name} does not support ${mode} mode.` },
            { status: 400 }
        );
    }

    const connector = getConnector(body.brokerId);
    if (!connector) {
        // Honest 501 instead of a green badge for something that was never built.
        return NextResponse.json(
            {
                status: 'not_implemented',
                reason: `No server connector for ${def.name} yet. Implemented: Alpaca, Binance, Dhan.`,
            },
            { status: 501 }
        );
    }
    if (!connector.supports(mode)) {
        return NextResponse.json(
            { status: 'error', reason: `${def.name} has no ${mode} environment — connecting would use a real account.` },
            { status: 400 }
        );
    }

    // Posted credentials win; otherwise fall back to server env.
    const posted = body.credentials ?? {};
    const hasPosted = def.credentials.every((f) => posted[f.key]?.trim());
    const creds = hasPosted ? posted : envCredentials(body.brokerId);
    if (!creds) {
        const missing = def.credentials.filter((f) => !posted[f.key]?.trim()).map((f) => f.key);
        return NextResponse.json({ status: 'error', reason: 'Missing credentials.', missing }, { status: 422 });
    }

    // Real authentication against the venue.
    const verdict = await connector.verify(creds, mode);
    if (!verdict.ok) {
        await recordConnection({
            broker_id: body.brokerId,
            label: def.name,
            mode,
            status: 'error',
            account_ref: null,
            last_verified_at: null,
            last_error: verdict.reason ?? 'verification failed',
        });
        return NextResponse.json({ status: 'error', reason: verdict.reason }, { status: 502 });
    }

    // Only now are the credentials worth keeping.
    const persisted = await storeCredentials(body.brokerId, mode, creds);
    await recordConnection({
        broker_id: body.brokerId,
        label: def.name,
        mode,
        status: 'connected',
        account_ref: verdict.accountRef ?? null,
        last_verified_at: new Date().toISOString(),
        last_error: null,
    });

    return NextResponse.json({
        status: persisted ? 'connected' : 'verified_not_persisted',
        brokerId: body.brokerId,
        mode,
        accountRef: verdict.accountRef,
        persisted,
        message: persisted
            ? 'Verified against the broker and stored in Supabase Vault.'
            : 'Verified against the broker, but NOT stored — configure Supabase to persist credentials.',
    });
}

export async function DELETE(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const url = new URL(req.url);
    const brokerId = url.searchParams.get('brokerId');
    const mode = (url.searchParams.get('mode') === 'live' ? 'live' : 'paper') as BrokerMode;
    if (!brokerId) return NextResponse.json({ error: 'brokerId required' }, { status: 400 });
    await removeConnection(brokerId, mode);
    return NextResponse.json({ ok: true });
}
