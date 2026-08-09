// Shared AI types (safe to import from client + server).

export type AgentId = 'signals' | 'journal' | 'briefing' | 'scanner' | 'coach';

export interface TradeSignal {
    symbol: string;
    side: 'buy' | 'sell';
    entry: number;
    stop: number;
    target: number;
    confidence: number; // 0-100
    rationale: string;
}

export interface JournalNote {
    mood: 'Calm' | 'FOMO' | 'Tilt' | 'Patient';
    note: string;
}

export interface AgentRunResult {
    agent: AgentId;
    provider?: string;
    source: 'ai' | 'heuristic' | 'error';
    data: unknown;
    ranAt: number;
}
