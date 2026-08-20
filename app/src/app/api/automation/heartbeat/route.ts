import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { recordHeartbeat } from '@/lib/automation/store';

// The browser says "I am here and I am trading".
//
// Deliberately NOT routed through cloudSync. That machinery debounces and merges store
// snapshots, which is the wrong shape for a mutual-exclusion primitive: the whole point
// of the lease is that it is written promptly and read authoritatively, not reconciled.
//
// Page routes are gated by middleware; API routes self-guard. This one is called from the
// browser, so it uses the session guard rather than CRON_SECRET.

export const runtime = 'nodejs';

export async function POST(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const ok = await recordHeartbeat(Date.now());
    return NextResponse.json({ ok });
}
