import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

// Per-user cloud state (gth_app_state), keyed by ADMIN_USER_ID. Service-role only.
export const runtime = 'nodejs';

const ALLOWED = new Set(['paper', 'agents', 'coach', 'ui', 'watchlists', 'alerts', 'learn']);

function userId(): string | null {
    return process.env.ADMIN_USER_ID || null;
}

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { key } = await params;
    if (!ALLOWED.has(key)) return NextResponse.json({ error: 'bad key' }, { status: 400 });

    const supabase = getServiceClient();
    const uid = userId();
    if (!supabase || !uid) return NextResponse.json({ configured: false, value: null });

    const { data, error } = await supabase.from('gth_app_state').select('value').eq('user_id', uid).eq('key', key).maybeSingle();
    if (error) return NextResponse.json({ configured: true, value: null, error: error.message });
    return NextResponse.json({ configured: true, value: data?.value ?? null });
}

export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { key } = await params;
    if (!ALLOWED.has(key)) return NextResponse.json({ error: 'bad key' }, { status: 400 });

    const supabase = getServiceClient();
    const uid = userId();
    if (!supabase || !uid) return NextResponse.json({ configured: false });

    let value: unknown;
    try {
        value = (await req.json()).value;
    } catch {
        return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    // MONOTONICITY GUARD on the paper book.
    //
    // cloudSync's writes are unconditional: a client that hydrated from localStorage and
    // SKIPPED a server row it could not validate will still PUT over that row 1.5s
    // later. That is how a device running an older build destroys a newer book — the
    // schema version is only the trigger, this write is the mechanism.
    //
    // `seq` is the engine's monotonic counter, and cloudSync already trusts it to decide
    // which copy is newer when hydrating. A lower seq is therefore a stale copy by
    // definition. The one legitimate way down is a genuine reset, which produces seq 0
    // with a NEW createdAt — so that case is allowed through explicitly.
    if (key === 'paper') {
        const { data: existing } = await supabase
            .from('gth_app_state')
            .select('value')
            .eq('user_id', uid)
            .eq('key', key)
            .maybeSingle();

        const prev = (existing?.value as { state?: { seq?: number; createdAt?: number } } | null)?.state;
        const next = (value as { state?: { seq?: number; createdAt?: number } } | null)?.state;

        if (prev && next) {
            const olderBook = (next.seq ?? -1) < (prev.seq ?? -1);
            const freshAccount = (next.createdAt ?? 0) > (prev.createdAt ?? 0);
            if (olderBook && !freshAccount) {
                return NextResponse.json(
                    {
                        configured: true,
                        ok: false,
                        reason: 'stale',
                        detail: 'A newer paper book is already stored. This write was refused rather than overwriting it.',
                        serverSeq: prev.seq ?? null,
                    },
                    { status: 409 }
                );
            }
        }
    }

    const { error } = await supabase
        .from('gth_app_state')
        .upsert({ user_id: uid, key, value, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
    if (error) return NextResponse.json({ configured: true, ok: false, error: error.message });
    return NextResponse.json({ configured: true, ok: true });
}
