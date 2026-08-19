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
    const { error } = await supabase
        .from('gth_app_state')
        .upsert({ user_id: uid, key, value, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
    if (error) return NextResponse.json({ configured: true, ok: false, error: error.message });
    return NextResponse.json({ configured: true, ok: true });
}
