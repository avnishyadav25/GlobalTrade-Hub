import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

// Live order routing. Real routing requires broker credentials stored server-side
// (Supabase Vault) + the per-broker adapter. Until those are configured this
// returns 501 so the caller (AgentEngine / OrderTicket) degrades to paper safely.

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ broker: string }> }) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { broker } = await params;

    const vaultConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    return NextResponse.json(
        {
            status: 'not_implemented',
            broker,
            message: vaultConfigured
                ? `Live routing for ${broker} needs its adapter enabled. Credentials are available via Vault; wire the broker SDK to go live.`
                : `Live routing needs stored credentials. Connect ${broker} in Settings and configure SUPABASE_SERVICE_ROLE_KEY (Vault).`,
        },
        { status: 501 }
    );
}
