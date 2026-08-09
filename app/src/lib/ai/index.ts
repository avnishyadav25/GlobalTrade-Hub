import 'server-only';

// Multi-provider LLM layer (server-only). DeepSeek is the default.
// Every provider exposes the same chat() contract; runLLM() picks the provider
// (arg → LLM_PROVIDER env → 'deepseek') and falls back to the next configured
// one when a key is missing or a call fails. Returns null when nothing is
// configured so callers can use a heuristic path.

export type Provider = 'deepseek' | 'openai' | 'gemini' | 'anthropic';

export interface LLMOptions {
    system?: string;
    prompt: string;
    json?: boolean;
    maxTokens?: number;
    temperature?: number;
}

const ORDER: Provider[] = ['deepseek', 'openai', 'gemini', 'anthropic'];

function keyFor(p: Provider): string | undefined {
    return {
        deepseek: process.env.DEEPSEEK_API_KEY,
        openai: process.env.OPENAI_API_KEY,
        gemini: process.env.GEMINI_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
    }[p];
}

export function configuredProviders(): Provider[] {
    return ORDER.filter((p) => keyFor(p));
}

/** Run a prompt against the resolved provider, with graceful fallback. */
export async function runLLM(opts: LLMOptions, provider?: Provider): Promise<{ text: string; provider: Provider } | null> {
    const preferred = provider || (process.env.LLM_PROVIDER as Provider) || 'deepseek';
    const chain = [preferred, ...ORDER.filter((p) => p !== preferred)].filter((p) => keyFor(p));
    for (const p of chain) {
        try {
            const text = await call(p, opts);
            if (text) return { text, provider: p };
        } catch {
            // try next provider
        }
    }
    return null;
}

function call(p: Provider, opts: LLMOptions): Promise<string> {
    switch (p) {
        case 'deepseek':
            return openAICompatible('https://api.deepseek.com/chat/completions', keyFor('deepseek')!, process.env.DEEPSEEK_MODEL || 'deepseek-chat', opts);
        case 'openai':
            return openAICompatible('https://api.openai.com/v1/chat/completions', keyFor('openai')!, process.env.OPENAI_MODEL || 'gpt-4o-mini', opts);
        case 'gemini':
            return gemini(opts);
        case 'anthropic':
            return anthropic(opts);
    }
}

async function openAICompatible(url: string, apiKey: string, model: string, opts: LLMOptions): Promise<string> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model,
            max_tokens: opts.maxTokens ?? 1024,
            temperature: opts.temperature ?? 0.4,
            ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
            messages: [
                ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
                { role: 'user', content: opts.prompt },
            ],
        }),
    });
    if (!res.ok) throw new Error(`llm ${res.status}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
}

async function gemini(opts: LLMOptions): Promise<string> {
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyFor('gemini')}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
            contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
            generationConfig: {
                maxOutputTokens: opts.maxTokens ?? 1024,
                temperature: opts.temperature ?? 0.4,
                ...(opts.json ? { responseMimeType: 'application/json' } : {}),
            },
        }),
    });
    if (!res.ok) throw new Error(`gemini ${res.status}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') ?? '';
}

async function anthropic(opts: LLMOptions): Promise<string> {
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': keyFor('anthropic')!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
            model,
            max_tokens: opts.maxTokens ?? 1024,
            ...(opts.system ? { system: opts.system } : {}),
            messages: [{ role: 'user', content: opts.prompt }],
        }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    return data?.content?.[0]?.text ?? '';
}

/** Best-effort JSON extraction from an LLM string response. */
export function parseJSON<T>(text: string): T | null {
    try {
        const start = text.indexOf('{');
        const arrStart = text.indexOf('[');
        const s = start === -1 ? arrStart : arrStart === -1 ? start : Math.min(start, arrStart);
        return JSON.parse(text.slice(s >= 0 ? s : 0)) as T;
    } catch {
        return null;
    }
}
