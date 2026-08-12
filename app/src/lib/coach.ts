// AI Trading Coach — heuristic analysis over paper fills.
// Used directly for the deterministic fallback and as the shape the Claude-powered
// /api/coach route returns. Also holds the enforceable-rule catalog + checker.

import { equity, toBase, deriveFxRates, type PaperState, type FillKind } from './paperEngine';
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
    /** Emitted by the paper engine; lets the coach tell opens from closes properly. */
    // Imported rather than re-declared: a duplicated literal union silently stops
    // accepting a PaperFill the moment a new kind is added.
    kind?: FillKind;
}

function inr(n: number): string {
    return (n >= 0 ? '+' : '−') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
}

/**
 * Deterministic coaching report from realized fills (base ₹).
 *
 * `fills` may arrive in any order (localStorage, a Supabase round-trip, an API), so
 * everything here sorts explicitly rather than relying on the store's newest-first
 * convention — an assumption that used to silently invert the cooldown rule.
 */
export function computeCoachReport(fills: FillLite[]): CoachReport {
    // Only closing fills realize P&L. `kind` is authoritative when present; the
    // pnl !== 0 fallback covers older payloads.
    const closes = fills.filter((f) => (f.kind ? f.kind !== 'open' && f.kind !== 'add' : f.pnl !== 0));
    const chrono = [...closes].sort((a, b) => a.ts - b.ts);
    const opens = fills.filter((f) => (f.kind ? f.kind === 'open' || f.kind === 'add' : f.pnl === 0))
        .sort((a, b) => a.ts - b.ts);

    const wins = closes.filter((f) => f.pnl > 0);
    const losses = closes.filter((f) => f.pnl < 0);
    const winRate = closes.length ? (wins.length / closes.length) * 100 : 0;
    const avgWin = wins.length ? wins.reduce((a, f) => a + f.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(losses.reduce((a, f) => a + f.pnl, 0) / losses.length) : 0;
    const avgRR = avgLoss ? avgWin / avgLoss : avgWin > 0 ? 2 : 0;

    // Revenge trading: a position OPENED within 12 min of closing a red trade.
    // The old detector compared close-to-close, because opening fills were filtered
    // out two lines earlier — so it never measured what its own description claimed.
    const REVENGE_WINDOW_MS = 12 * 60 * 1000;
    const revengeTrades: FillLite[] = [];
    for (const loss of chrono.filter((f) => f.pnl < 0)) {
        const next = opens.find((o) => o.ts > loss.ts && o.ts - loss.ts < REVENGE_WINDOW_MS);
        if (next) revengeTrades.push(next);
    }
    const revenge = revengeTrades.length;
    // Cost of the trades that were ACTUALLY flagged: for each revenge open, the next
    // close on the same symbol. The old version summed the N most recent losses, which
    // had no causal link to the detected pattern.
    const revengeCost = revengeTrades.reduce((sum, open) => {
        const close = chrono.find((c) => c.symbol === open.symbol && c.ts > open.ts);
        return sum + (close && close.pnl < 0 ? close.pnl : 0);
    }, 0);

    const ruleAdherence = Math.max(0, Math.min(100, Math.round(100 - revenge * 6)));
    const disciplineScore = scoreFrom(winRate, avgRR, ruleAdherence);

    const patterns: CoachPattern[] = [];
    if (revenge > 0)
        patterns.push({
            sev: 'High',
            freq: `${revenge} occurrence${revenge > 1 ? 's' : ''}`,
            title: 'Revenge trading after a loss',
            desc: 'You opened a new position within 12 min of closing a red trade. These bounce-back trades tend to lose more than your average.',
            cost: revengeCost < 0 ? inr(revengeCost) : 'no measurable cost yet',
        });
    // Needs winners to talk about cutting winners early, and enough trades to mean
    // anything. It used to fire at avgRR 0 — i.e. with ZERO winners.
    if (wins.length > 0 && closes.length >= 5 && avgRR < 2)
        patterns.push({
            sev: 'Medium',
            freq: `${wins.length} of ${closes.length} trades won`,
            title: 'Cutting winners too early',
            desc: `Your average win is ${inr(avgWin)} against an average loss of ${inr(-avgLoss)} — an R:R of ${avgRR.toFixed(1)}, below a 2.0 target.`,
            cost: '—',
        });
    if (!patterns.length)
        patterns.push({ sev: 'Low', freq: 'so far', title: 'Clean tape', desc: 'No major behavioural leaks detected yet. Keep logging trades so the coach can learn your patterns.', cost: '—' });

    const bars: CoachBar[] = [
        { label: 'Rule adherence', val: ruleAdherence, col: ruleAdherence >= 70 ? 'var(--up)' : 'var(--warn)' },
        { label: 'Win rate', val: Math.round(winRate), col: winRate >= 50 ? 'var(--up)' : 'var(--warn)' },
        { label: 'Reward:risk', val: Math.round(Math.min(100, (avgRR / 3) * 100)), col: avgRR >= 2 ? 'var(--up)' : 'var(--warn)' },
        { label: 'FOMO control', val: Math.max(0, Math.min(100, 100 - revenge * 12)), col: revenge > 1 ? 'var(--down)' : 'var(--up)' },
    ];

    const moodFor = (f: FillLite, prev?: FillLite): CoachJournalEntry['mood'] => {
        if (prev && prev.pnl < 0 && f.ts - prev.ts < REVENGE_WINDOW_MS) return 'Tilt';
        if (f.pnl > 0) return 'Calm';
        return 'FOMO';
    };
    const journal: CoachJournalEntry[] = chrono
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
        trend: disciplineTrend(chrono),
        patterns,
        bars,
        journal,
        source: 'heuristic',
        summary: closes.length
            ? `Analysed ${closes.length} closed paper trades — discipline ${disciplineScore}/100.`
            : 'Place a few paper trades and the coach will start finding patterns.',
    };
}

function scoreFrom(winRate: number, avgRR: number, ruleAdherence: number): number {
    return Math.max(0, Math.min(100, Math.round(0.4 * winRate + 0.3 * Math.min(100, avgRR * 40) + 0.3 * ruleAdherence)));
}

/**
 * Real discipline history: the score recomputed over each of the last 7 days that
 * actually contain trades. Returns fewer than 7 points when there is less history —
 * the previous version returned [54,58,61,59,65,68,score], six of which were literals
 * rendered as if they were the user's own past.
 */
export function disciplineTrend(chrono: FillLite[]): number[] {
    if (!chrono.length) return [];
    const dayOf = (ts: number) => new Date(ts).setHours(0, 0, 0, 0);
    const days = [...new Set(chrono.map((f) => dayOf(f.ts)))].sort((a, b) => a - b).slice(-7);
    return days.map((end) => {
        const upto = chrono.filter((f) => f.ts <= end + 86_399_999);
        const w = upto.filter((f) => f.pnl > 0);
        const l = upto.filter((f) => f.pnl < 0);
        const wr = upto.length ? (w.length / upto.length) * 100 : 0;
        const aw = w.length ? w.reduce((a, f) => a + f.pnl, 0) / w.length : 0;
        const al = l.length ? Math.abs(l.reduce((a, f) => a + f.pnl, 0) / l.length) : 0;
        const rr = al ? aw / al : aw > 0 ? 2 : 0;
        return scoreFrom(wr, rr, 100);
    });
}

/** Enforce applied rules at order-placement time. */
export function checkRules(
    applied: Record<string, boolean>,
    state: PaperState,
    input: { symbol: string; qty: number; price: number },
    quotes: Record<string, LiveQuote>
): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const closes = state.fills.filter((f) => (f.kind ? f.kind !== 'open' && f.kind !== 'add' : f.pnl !== 0));

    if (applied.cooldown_after_loss) {
        // Reduce to the MAXIMUM timestamp rather than taking the first match. `find`
        // only returned the most recent loss because the store happens to prepend
        // fills; a JSON round-trip through Supabase could reverse that and silently
        // turn this rule into a no-op.
        const lastLoss = closes.reduce<{ ts: number } | null>(
            (acc, f) => (f.pnl < 0 && (!acc || f.ts > acc.ts) ? f : acc),
            null
        );
        if (lastLoss && now - lastLoss.ts < 30 * 60 * 1000) {
            const mins = Math.ceil((30 * 60 * 1000 - (now - lastLoss.ts)) / 60000);
            return { allowed: false, reason: `Cooldown active — ${mins} min left after your last loss.` };
        }
    }
    if (applied.max_position_pct) {
        // `||` treated 0 and NaN as "unset"; guard explicitly so a genuinely negative
        // or non-finite equity doesn't silently fall back to the starting cash.
        const raw = equity(state, quotes, deriveFxRates(quotes));
        const eq = Number.isFinite(raw) && raw > 0 ? raw : state.account.startingCash;
        const value = toBase(input.symbol, input.qty * input.price, deriveFxRates(quotes));
        if (value > eq * 0.25) return { allowed: false, reason: 'Order exceeds 25% of equity (position-size cap).' };
    }
    if (applied.daily_two_loss_stop) {
        const startOfDay = new Date().setHours(0, 0, 0, 0);
        // Count ROUND TRIPS, not fills: a single position exited in three partial
        // fills used to count as three losses and trip a 2-loss stop on one trade.
        // Fills of the same symbol within a minute of each other are one exit.
        const todaysLosses = closes
            .filter((f) => f.pnl < 0 && f.ts >= startOfDay)
            .sort((a, b) => a.ts - b.ts);
        let roundTrips = 0;
        let prev: { symbol: string; ts: number } | null = null;
        for (const f of todaysLosses) {
            if (!prev || f.symbol !== prev.symbol || f.ts - prev.ts > 60_000) roundTrips++;
            prev = f;
        }
        if (roundTrips >= 2) return { allowed: false, reason: 'Daily 2-loss stop hit — trading disabled for today.' };
    }
    return { allowed: true };
}

// Summary payload sent to the AI route (anonymised: no account IDs).
// The shape must match CoachRequest in app/api/coach/route.ts — the stats live under
// `stats`, not at the top level. They were flat here previously, so `body.stats` was
// always undefined and every prompt contained the literal string "Stats: undefined".
export function summariseForAI(fills: FillLite[]) {
    const report = computeCoachReport(fills);
    // Sort defensively rather than trusting the caller's array order.
    const recent = [...fills].sort((a, b) => b.ts - a.ts).slice(0, 20);
    return {
        stats: {
            tradesAnalyzed: report.tradesAnalyzed,
            winRate: +report.winRate.toFixed(1),
            avgRR: +report.avgRR.toFixed(2),
        },
        recent: recent.map((f) => ({ sym: f.symbol, side: f.side, pnl: Math.round(f.pnl), ts: f.ts })),
    };
}
