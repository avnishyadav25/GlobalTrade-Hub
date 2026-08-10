import { NextResponse } from 'next/server';
import { runLLM, parseJSON, type Provider } from '@/lib/ai';

// AI Trading Coach — server-side, multi-provider (DeepSeek default). Falls back to
// source:'heuristic' when no LLM key is configured so the client keeps its report.

export const runtime = 'nodejs';

interface CoachRequest {
    stats: { tradesAnalyzed: number; winRate: number; avgRR: number };
    recent: { sym: string; side: string; pnl: number; ts: number }[];
    provider?: Provider;
}

export async function POST(req: Request) {
    let body: CoachRequest;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    const system = 'You are a disciplined trading coach. Analyse the trader\'s recent trades and reply ONLY with minified JSON.';
    const prompt = [
        'Identify up to 3 behavioural patterns from the stats and recent trade P&L (INR).',
        'JSON shape: {"patterns":[{"sev":"High|Medium|Low","freq":"string","title":"string","desc":"string","cost":"string"}],"summary":"one sentence"}',
        `Stats: ${JSON.stringify(body.stats)}`,
        `Recent trades: ${JSON.stringify(body.recent)}`,
    ].join('\n');

    const result = await runLLM({ system, prompt, json: true, maxTokens: 1024 }, body.provider);
    if (!result) return NextResponse.json({ source: 'heuristic', patterns: [], summary: null });

    const parsed = parseJSON<{ patterns?: unknown[]; summary?: string }>(result.text);
    return NextResponse.json({
        source: 'ai',
        provider: result.provider,
        patterns: parsed?.patterns ?? [],
        summary: parsed?.summary ?? null,
    });
}
