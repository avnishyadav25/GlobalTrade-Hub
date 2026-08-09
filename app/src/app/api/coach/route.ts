import { NextResponse } from 'next/server';

// AI Trading Coach — server-side. Uses the Claude API when ANTHROPIC_API_KEY is
// configured (key never reaches the browser); otherwise returns source:'heuristic'
// so the client keeps its deterministic report.

export const runtime = 'nodejs';

interface CoachRequest {
    stats: { tradesAnalyzed: number; winRate: number; avgRR: number };
    recent: { sym: string; side: string; pnl: number; ts: number }[];
}

export async function POST(req: Request) {
    let body: CoachRequest;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ source: 'heuristic', patterns: [], summary: null });
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
    const prompt = [
        'You are a disciplined trading coach analysing a trader\'s recent trades.',
        'Given the aggregate stats and recent trade P&L (in INR), identify up to 3 behavioural patterns.',
        'Respond ONLY with minified JSON of shape:',
        '{"patterns":[{"sev":"High|Medium|Low","freq":"string","title":"string","desc":"string","cost":"string"}],"summary":"one sentence"}',
        '',
        `Stats: ${JSON.stringify(body.stats)}`,
        `Recent trades: ${JSON.stringify(body.recent)}`,
    ].join('\n');

    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }],
            }),
        });
        if (!res.ok) {
            return NextResponse.json({ source: 'heuristic', patterns: [], summary: null, error: `upstream ${res.status}` });
        }
        const data = await res.json();
        const text: string = data?.content?.[0]?.text ?? '{}';
        const jsonStart = text.indexOf('{');
        const parsed = JSON.parse(text.slice(jsonStart >= 0 ? jsonStart : 0));
        return NextResponse.json({ source: 'ai', patterns: parsed.patterns ?? [], summary: parsed.summary ?? null });
    } catch (e) {
        return NextResponse.json({ source: 'heuristic', patterns: [], summary: null, error: String(e) });
    }
}
