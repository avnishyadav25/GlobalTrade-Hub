import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { currentIpos } from '@/lib/marketData/providers/nseIpo';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const issues = await currentIpos();
    // null means the source failed; an empty array means there is genuinely nothing open.
    // The screen renders those two very differently, so they must not be collapsed here.
    return NextResponse.json({
        available: issues !== null,
        issues: issues ?? [],
        at: Date.now(),
    });
}
