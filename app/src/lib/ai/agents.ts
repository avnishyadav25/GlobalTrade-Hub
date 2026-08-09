import 'server-only';

// Server-side AI agents. Each takes a data snapshot (posted by the client) and
// calls the multi-provider LLM layer. All degrade to a heuristic when no key is set.

import { runLLM, parseJSON, type Provider } from './index';
import type { TradeSignal, JournalNote } from './types';

export interface MarketSnapshot {
    symbol: string;
    price: number;
    changePercent: number;
    rsi?: number;
}
export interface PositionSnapshot {
    symbol: string;
    qty: number;
    avgPrice: number;
}

// ---- Trading-signal agent ----
export async function generateSignals(
    market: MarketSnapshot[],
    positions: PositionSnapshot[],
    provider?: Provider
): Promise<{ signals: TradeSignal[]; source: 'ai' | 'heuristic'; provider?: string }> {
    const system = 'You are a professional multi-asset trading analyst. Reply ONLY with minified JSON.';
    const prompt = [
        'From this market snapshot and open positions, propose 1-3 high-conviction trade ideas.',
        'JSON: {"signals":[{"symbol":"","side":"buy|sell","entry":0,"stop":0,"target":0,"confidence":0,"rationale":""}]}',
        `Market: ${JSON.stringify(market.slice(0, 16))}`,
        `Positions: ${JSON.stringify(positions)}`,
    ].join('\n');

    const res = await runLLM({ system, prompt, json: true, maxTokens: 900 }, provider);
    if (res) {
        const parsed = parseJSON<{ signals?: TradeSignal[] }>(res.text);
        if (parsed?.signals?.length) return { signals: parsed.signals.slice(0, 3), source: 'ai', provider: res.provider };
    }
    return { signals: heuristicSignals(market), source: 'heuristic' };
}

function heuristicSignals(market: MarketSnapshot[]): TradeSignal[] {
    // momentum + RSI heuristic fallback
    return market
        .map((m) => {
            const rsi = m.rsi ?? 50;
            let side: 'buy' | 'sell' | null = null;
            if (rsi < 35 && m.changePercent > -3) side = 'buy';
            else if (rsi > 68) side = 'sell';
            if (!side) return null;
            const dir = side === 'buy' ? 1 : -1;
            return {
                symbol: m.symbol,
                side,
                entry: m.price,
                stop: +(m.price * (1 - dir * 0.02)).toFixed(4),
                target: +(m.price * (1 + dir * 0.05)).toFixed(4),
                confidence: side === 'buy' ? 62 : 58,
                rationale: side === 'buy' ? `RSI ${rsi.toFixed(0)} oversold with stabilising price` : `RSI ${rsi.toFixed(0)} overbought — mean-reversion short`,
            } as TradeSignal;
        })
        .filter(Boolean)
        .slice(0, 3) as TradeSignal[];
}

// ---- Journal-writer agent ----
export async function writeJournal(
    trade: { symbol: string; side: string; pnl: number; entry?: number; exit?: number },
    provider?: Provider
): Promise<{ note: JournalNote; source: 'ai' | 'heuristic' }> {
    const system = 'You are a trading coach writing a short, candid journal note. Reply ONLY with minified JSON.';
    const prompt = [
        'Write a one-sentence coach note and a mood tag for this closed trade.',
        'JSON: {"mood":"Calm|FOMO|Tilt|Patient","note":""}',
        `Trade: ${JSON.stringify(trade)}`,
    ].join('\n');
    const res = await runLLM({ system, prompt, json: true, maxTokens: 200 }, provider);
    if (res) {
        const parsed = parseJSON<JournalNote>(res.text);
        if (parsed?.note) return { note: parsed, source: 'ai' };
    }
    return {
        note: {
            mood: trade.pnl >= 0 ? 'Calm' : 'FOMO',
            note: trade.pnl >= 0 ? 'Trade closed in profit — sized and timed to plan.' : 'Loss within plan. Review the entry trigger.',
        },
        source: 'heuristic',
    };
}

// ---- Daily-briefing agent ----
export async function dailyBriefing(
    market: MarketSnapshot[],
    positions: PositionSnapshot[],
    provider?: Provider
): Promise<{ text: string; source: 'ai' | 'heuristic'; provider?: string }> {
    const system = 'You are a markets desk analyst writing a concise morning brief (max 180 words, markdown, no preamble).';
    const prompt = [
        'Write a morning brief across crypto, Indian & US equities, forex and commodities using this snapshot. End with 2-3 watch items.',
        `Market: ${JSON.stringify(market.slice(0, 16))}`,
        `Positions: ${JSON.stringify(positions)}`,
    ].join('\n');
    const res = await runLLM({ system, prompt, maxTokens: 700, temperature: 0.6 }, provider);
    if (res) return { text: res.text, source: 'ai', provider: res.provider };

    const movers = [...market].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 4);
    const text =
        `**Morning brief**\n\n` +
        movers.map((m) => `- ${m.symbol}: ${m.changePercent >= 0 ? '+' : ''}${m.changePercent.toFixed(2)}% at ${m.price}`).join('\n') +
        `\n\nWatch: biggest movers above. Manage risk on open positions.`;
    return { text, source: 'heuristic' };
}

// ---- NL scanner agent ----
export async function nlToScanCriteria(query: string, provider?: Provider): Promise<{ criteria: unknown; source: 'ai' | 'heuristic' }> {
    const system = 'Convert the request into scanner criteria JSON. Reply ONLY with minified JSON.';
    const prompt = [
        'Fields: {"markets":"all"|["crypto"|"india"|"us"|"forex"|"commodity"],"changeMin":num,"changeMax":num,"rsiBelow":num,"rsiAbove":num,"nearHighPct":num}',
        `Request: "${query}"`,
    ].join('\n');
    const res = await runLLM({ system, prompt, json: true, maxTokens: 300 }, provider);
    if (res) {
        const parsed = parseJSON<unknown>(res.text);
        if (parsed) return { criteria: parsed, source: 'ai' };
    }
    // heuristic keyword mapping
    const q = query.toLowerCase();
    const criteria: Record<string, unknown> = { markets: 'all' };
    if (q.includes('oversold')) criteria.rsiBelow = 35;
    if (q.includes('overbought')) criteria.rsiAbove = 65;
    if (q.includes('gainer') || q.includes('up')) criteria.changeMin = 1;
    if (q.includes('loser') || q.includes('down')) criteria.changeMax = -1;
    if (q.includes('breakout')) criteria.nearHighPct = 0.5;
    return { criteria, source: 'heuristic' };
}
