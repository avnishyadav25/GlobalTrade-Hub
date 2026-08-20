import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { readLease } from '@/lib/automation/store';
import { leaseHolder, LEASE_TTL_MS } from '@/lib/automation/lease';

// Is automation actually running, and what did it last do?
//
// Everything here is derived from EVIDENCE — a heartbeat that arrived, a run that
// happened — never from a setting being switched on. A scheduler on a sleeping laptop is
// not running, and a screen that says otherwise is the exact failure this codebase keeps
// having to correct.
//
// `holder` deliberately excludes the calling tab's own heartbeat being fresh as proof
// that the SERVER is alive: those are separate facts and the UI shows them separately.

export const runtime = 'nodejs';

export async function GET(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const now = Date.now();
    const lease = await readLease();

    return NextResponse.json({
        now,
        holder: leaseHolder(lease, now),
        ttlMs: LEASE_TTL_MS,
        browserHeartbeatAt: lease?.browserHeartbeatAt ?? null,
        serverRanAt: lease?.serverRanAt ?? null,
        lastRun: lease?.lastRun ?? null,
        /** Null when Supabase is not configured — which is itself worth showing. */
        configured: lease !== null,
    });
}
