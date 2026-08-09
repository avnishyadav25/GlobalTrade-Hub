import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { generateSignals, writeJournal, dailyBriefing, nlToScanCriteria } from '@/lib/ai/agents';
import type { Provider } from '@/lib/ai';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ agent: string }> }) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { agent } = await params;
    let body: Record<string, unknown> = {};
    try {
        body = await req.json();
    } catch {
        /* empty body ok */
    }
    const provider = body.provider as Provider | undefined;
    const market = (body.market as never) ?? [];
    const positions = (body.positions as never) ?? [];

    try {
        switch (agent) {
            case 'signals': {
                const r = await generateSignals(market, positions, provider);
                return NextResponse.json({ agent, ...r, ranAt: Date.now() });
            }
            case 'journal': {
                const r = await writeJournal(body.trade as never, provider);
                return NextResponse.json({ agent, ...r, ranAt: Date.now() });
            }
            case 'briefing': {
                const r = await dailyBriefing(market, positions, provider);
                return NextResponse.json({ agent, ...r, ranAt: Date.now() });
            }
            case 'scanner': {
                const r = await nlToScanCriteria(String(body.query ?? ''), provider);
                return NextResponse.json({ agent, ...r, ranAt: Date.now() });
            }
            default:
                return NextResponse.json({ error: 'unknown agent' }, { status: 404 });
        }
    } catch (e) {
        return NextResponse.json({ agent, source: 'error', error: String(e) }, { status: 500 });
    }
}
