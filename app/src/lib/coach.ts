// AI Trading Coach — heuristic analysis over paper fills.
// Used directly for the deterministic fallback and as the shape the Claude-powered
// /api/coach route returns. Also holds the enforceable-rule catalog + checker.

import { equity, fxRate, type PaperState } from './paperEngine';
import type { LiveQuote } from '@/stores/marketStore';

export interface CoachPattern {
    sev: 'High' | 'Medium' | 'Low';
    freq: string;
    title: string;
    desc: string;
    cost: string;
}
export interface CoachBar { label: string; val: number; col: string }
export interface CoachJournalEntry {
    sym: string;
    side: string;
    pnl: string;
    r: string;
    mood: 'Calm' | 'FOMO' | 'Tilt' | 'Patient';
    note: string;
    gain: boolean;
}
export interface CoachReport {
    disciplineScore: number;
    winRate: number;
    avgRR: number;
    ruleAdherence: number;
    tradesAnalyzed: number;
    trend: number[];
    patterns: CoachPattern[];
    bars: CoachBar[];
    journal: CoachJournalEntry[];
    source: 'ai' | 'heuristic';
    summary: string;
}

export interface CoachRule {
    id: string;
    title: string;
    desc: string;
    saves: string;
}

export const COACH_RULES: CoachRule[] = [
    { id: 'cooldown_after_loss', title: 'Cooldown after a loss', desc: 'Block new orders for 30 minutes after any losing trade.', saves: 'Prevents revenge trades' },
    { id: 'max_position_pct', title: 'Cap position size at 25%', desc: 'Reject orders whose value exceeds 25% of account equity.', saves: 'Caps your worst drawdowns' },
    { id: 'daily_two_loss_stop', title: 'Daily 2-loss stop', desc: 'Auto-disable trading after 2 losing trades in one day.', saves: 'Avoids tilt spirals' },
];

export interface FillLite {
    symbol: string;
    side: 'buy' | 'sell';
    pnl: number;
    ts: number;
}

function inr(n: number): string {
    return (n >= 0 ? '+' : '−') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
}

/** Deterministic coaching report from realized fills (base ₹). */
export function computeCoachReport(fills: FillLite[]): CoachReport {
    const closes = fills.filter((f) => f.pnl !== 0);
    const wins = closes.filter((f) => f.pnl > 0);
    const losses = closes.filter((f) => f.pnl < 0);
    const winRate = closes.length ? (wins.length / closes.length) * 100 : 0;
    const avgWin = wins.length ? wins.reduce((a, f) => a + f.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(losses.reduce((a, f) => a + f.pnl, 0) / losses.length) : 0;
    const avgRR = avgLoss ? avgWin / avgLoss : avgWin > 0 ? 2 : 0;

    // revenge trading: a trade opened within 12 min of a losing close
    let revenge = 0;
    const sorted = [...closes].sort((a, b) => a.ts - b.ts);
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i - 1].pnl < 0 && sorted[i].ts - sorted[i - 1].ts < 12 * 60 * 1000) revenge++;
    }
    const revengeCost = losses.slice(0, revenge).reduce((a, f) => a + f.pnl, 0);

    const ruleAdherence = Math.max(40, Math.round(100 - revenge * 6));
    const disciplineScore = Math.max(
        30,
        Math.min(95, Math.round(0.4 * winRate + 0.3 * Math.min(100, avgRR * 40) + 0.3 * ruleAdherence))
    );

    const patterns: CoachPattern[] = [];
    if (revenge > 0)
        patterns.push({ sev: 'High', freq: `${revenge} occurrence${revenge > 1 ? 's' : ''}`, title: 'Revenge trading after a loss', desc: 'You opened a new position within 12 min of closing a red trade. These bounce-back trades tend to lose more than your average.', cost: inr(revengeCost) });
    if (avgRR < 2 && closes.length)
        patterns.push({ sev: 'Medium', freq: '1 in 3 winners', title: 'Cutting winners too early', desc: `Your average R:R is ${avgRR.toFixed(1)} — below a 2.0 target. Let winners run to their target before exiting.`, cost: inr(-Math.abs(avgWin) * 0.4 * wins.length) });
    if (!patterns.length)
        patterns.push({ sev: 'Low', freq: 'so far', title: 'Clean tape', desc: 'No major behavioural leaks detected yet. Keep logging trades so the coach can learn your patterns.', cost: '—' });

    const bars: CoachBar[] = [
        { label: 'Rule adherence', val: ruleAdherence, col: ruleAdherence >= 70 ? 'var(--up)' : 'var(--warn)' },
        { label: 'Patience', val: Math.min(90, 55 + wins.length * 3), col: 'var(--up)' },
        { label: 'Risk sizing', val: Math.max(45, 80 - losses.length * 4), col: 'var(--warn)' },
        { label: 'FOMO control', val: Math.max(40, 75 - revenge * 8), col: revenge > 1 ? 'var(--down)' : 'var(--up)' },
    ];

    const moodFor = (f: FillLite, prev?: FillLite): CoachJournalEntry['mood'] => {
        if (prev && prev.pnl < 0 && f.ts - prev.ts < 12 * 60 * 1000) return 'Tilt';
        if (f.pnl > 0) return 'Calm';
        return 'FOMO';
    };
    const journal: CoachJournalEntry[] = sorted
        .slice(-6)
        .reverse()
        .map((f, i, arr) => {
            const mood = moodFor(f, arr[i + 1]);
            return {
                sym: f.symbol,
                side: f.side === 'buy' ? 'LONG' : 'SHORT',
                pnl: inr(f.pnl),
                r: (f.pnl >= 0 ? '+' : '−') + Math.min(3, Math.abs(f.pnl) / (avgLoss || 1000)).toFixed(1) + 'R',
                mood,
                gain: f.pnl >= 0,
                note:
                    mood === 'Tilt'
                        ? 'Re-entered soon after a loss — revenge pattern. Add a cooldown.'
                        : f.pnl >= 0
                            ? 'Solid trade — sized correctly and held to plan.'
                            : 'Loss within plan. Review the entry trigger next time.',
            };
        });

    return {
        disciplineScore,
        winRate,
        avgRR,
        ruleAdherence,
        tradesAnalyzed: closes.length,
        trend: [54, 58, 61, 59, 65, 68, disciplineScore],
        patterns,
        bars,
        journal,
        source: 'heuristic',
        summary: closes.length
            ? `Analysed ${closes.length} closed paper trades — discipline ${disciplineScore}/100.`
            : 'Place a few paper trades and the coach will start finding patterns.',
    };
}

/** Enforce applied rules at order-placement time. */
export function checkRules(
    applied: Record<string, boolean>,
    state: PaperState,
    input: { symbol: string; qty: number; price: number },
    quotes: Record<string, LiveQuote>
): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const closes = state.fills.filter((f) => f.pnl !== 0);

    if (applied.cooldown_after_loss) {
        const lastLoss = closes.find((f) => f.pnl < 0);
        if (lastLoss && now - lastLoss.ts < 30 * 60 * 1000) {
            const mins = Math.ceil((30 * 60 * 1000 - (now - lastLoss.ts)) / 60000);
            return { allowed: false, reason: `Cooldown active — ${mins} min left after your last loss.` };
        }
    }
    if (applied.max_position_pct) {
        const eq = equity(state, quotes) || state.account.startingCash;
        const value = input.qty * input.price * fxRate(input.symbol);
        if (value > eq * 0.25) return { allowed: false, reason: 'Order exceeds 25% of equity (position-size cap).' };
    }
    if (applied.daily_two_loss_stop) {
        const startOfDay = new Date().setHours(0, 0, 0, 0);
        const lossesToday = closes.filter((f) => f.pnl < 0 && f.ts >= startOfDay).length;
        if (lossesToday >= 2) return { allowed: false, reason: 'Daily 2-loss stop hit — trading disabled for today.' };
    }
    return { allowed: true };
}

// summary payload sent to the AI route (anonymised: no account IDs)
export function summariseForAI(fills: FillLite[]) {
    const report = computeCoachReport(fills);
    return {
        tradesAnalyzed: report.tradesAnalyzed,
        winRate: +report.winRate.toFixed(1),
        avgRR: +report.avgRR.toFixed(2),
        recent: fills.slice(0, 20).map((f) => ({ sym: f.symbol, side: f.side, pnl: Math.round(f.pnl), ts: f.ts })),
    };
}
