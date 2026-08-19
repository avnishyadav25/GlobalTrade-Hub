import { describe, it, expect } from 'vitest';
import { computeCoachReport, checkRules, summariseForAI, disciplineTrend, type FillLite } from './coach';
import { newPaperState, type PaperState } from './paperEngine';
import type { LiveQuote } from '@/stores/marketStore';

const MIN = 60_000;
const base = Date.UTC(2026, 7, 10, 12, 0, 0);

const fill = (o: Partial<FillLite> & { ts: number }): FillLite => ({
    symbol: 'BTC/USDT',
    side: 'buy',
    pnl: 0,
    ...o,
});

describe('revenge detection', () => {
    it('measures close → OPEN, matching what the UI claims', () => {
        // A loss closes, then a new position OPENS 5 minutes later.
        const fills: FillLite[] = [
            fill({ ts: base, pnl: -500, kind: 'close' }),
            fill({ ts: base + 5 * MIN, pnl: 0, kind: 'open' }),
        ];
        const r = computeCoachReport(fills);
        expect(r.patterns.some((p) => p.title.includes('Revenge'))).toBe(true);
    });

    it('does not fire when the next open is outside the window', () => {
        const fills: FillLite[] = [
            fill({ ts: base, pnl: -500, kind: 'close' }),
            fill({ ts: base + 40 * MIN, pnl: 0, kind: 'open' }),
        ];
        const r = computeCoachReport(fills);
        expect(r.patterns.some((p) => p.title.includes('Revenge'))).toBe(false);
    });

    it('does not fire for two closes in quick succession with no open between', () => {
        // The old detector compared close-to-close, so this used to be flagged.
        const fills: FillLite[] = [
            fill({ ts: base, pnl: -500, kind: 'close' }),
            fill({ ts: base + 2 * MIN, pnl: -200, kind: 'close' }),
        ];
        const r = computeCoachReport(fills);
        expect(r.patterns.some((p) => p.title.includes('Revenge'))).toBe(false);
    });
});

describe('"cutting winners early" pattern', () => {
    it('does NOT fire when there are zero winners', () => {
        // Regression: avgRR was 0 with no wins, and 0 < 2, so a 100%-loss trader was
        // told to "let winners run".
        const fills: FillLite[] = Array.from({ length: 6 }, (_, i) =>
            fill({ ts: base + i * 60 * MIN, pnl: -100, kind: 'close' })
        );
        const r = computeCoachReport(fills);
        expect(r.patterns.some((p) => p.title.includes('Cutting winners'))).toBe(false);
    });

    it('fires when there are winners but the R:R is poor', () => {
        const fills: FillLite[] = [
            ...Array.from({ length: 3 }, (_, i) => fill({ ts: base + i * 60 * MIN, pnl: 50, kind: 'close' })),
            ...Array.from({ length: 3 }, (_, i) => fill({ ts: base + (i + 3) * 60 * MIN, pnl: -200, kind: 'close' })),
        ];
        const r = computeCoachReport(fills);
        expect(r.patterns.some((p) => p.title.includes('Cutting winners'))).toBe(true);
    });
});

describe('discipline trend', () => {
    it('is empty with no trades, rather than six invented literals', () => {
        expect(computeCoachReport([]).trend).toEqual([]);
        // Regression guard: the old value was [54,58,61,59,65,68,score].
        expect(computeCoachReport([]).trend).not.toContain(54);
    });

    it('produces one point per trading day, capped at 7', () => {
        const fills: FillLite[] = Array.from({ length: 10 }, (_, d) =>
            fill({ ts: base + d * 86_400_000, pnl: d % 2 ? 100 : -50, kind: 'close' })
        );
        const t = disciplineTrend([...fills].sort((a, b) => a.ts - b.ts));
        expect(t.length).toBe(7);
        expect(t.every((n) => Number.isFinite(n) && n >= 0 && n <= 100)).toBe(true);
    });
});

describe('checkRules is order-independent', () => {
    const quotes: Record<string, LiveQuote> = {};

    function stateWithFills(fills: FillLite[]): PaperState {
        const s = newPaperState();
        return {
            ...s,
            fills: fills.map((f, i) => ({
                id: `f${i}`,
                orderId: `o${i}`,
                symbol: f.symbol,
                market: 'crypto' as const,
                side: f.side,
                kind: (f.kind ?? 'close') as never,
                qty: 1,
                price: 100,
                fee: 0,
                pnl: f.pnl,
                ts: f.ts,
            })),
        };
    }

    it('blocks during the cooldown regardless of array order', () => {
        const now = Date.now();
        const fills: FillLite[] = [
            fill({ ts: now - 5 * MIN, pnl: -100, kind: 'close' }),   // recent loss
            fill({ ts: now - 300 * MIN, pnl: -100, kind: 'close' }), // old loss
        ];
        const input = { symbol: 'BTC/USDT', qty: 1, price: 100 };
        const applied = { cooldown_after_loss: true };

        const newestFirst = checkRules(applied, stateWithFills(fills), input, quotes);
        const oldestFirst = checkRules(applied, stateWithFills([...fills].reverse()), input, quotes);

        expect(newestFirst.allowed).toBe(false);
        // Regression: `closes.find(...)` returned the OLDEST loss when the array was
        // reversed by a Supabase round-trip, silently disabling the rule.
        expect(oldestFirst.allowed).toBe(false);
        expect(oldestFirst.reason).toBe(newestFirst.reason);
    });

    it('allows when the last loss is outside the cooldown', () => {
        const fills = [fill({ ts: Date.now() - 120 * MIN, pnl: -100, kind: 'close' })];
        const r = checkRules({ cooldown_after_loss: true }, stateWithFills(fills), { symbol: 'BTC/USDT', qty: 1, price: 100 }, quotes);
        expect(r.allowed).toBe(true);
    });

    it('does not fall back to starting cash when equity is merely small', () => {
        const s = newPaperState();
        const drained: PaperState = { ...s, account: { ...s.account, cash: 1000 } };
        // 25% of ₹1,000 is ₹250; a ₹50,000 order must be blocked, not measured
        // against the ₹5,00,000 starting cash.
        const r = checkRules({ max_position_pct: true }, drained, { symbol: 'RELIANCE', qty: 10, price: 5000 }, quotes);
        expect(r.allowed).toBe(false);
    });
});

describe('summariseForAI', () => {
    it('nests stats under `stats` so the route can read them', () => {
        const payload = summariseForAI([fill({ ts: base, pnl: 100, kind: 'close' })]);
        // Regression: this was flat, so the route's `body.stats` was undefined and
        // every prompt contained the literal string "Stats: undefined".
        expect(payload.stats).toBeDefined();
        expect(typeof payload.stats.tradesAnalyzed).toBe('number');
        expect(Array.isArray(payload.recent)).toBe(true);
    });

    it('sorts recent trades newest-first regardless of input order', () => {
        const payload = summariseForAI([
            fill({ ts: base, pnl: 1, kind: 'close' }),
            fill({ ts: base + 10 * MIN, pnl: 2, kind: 'close' }),
        ]);
        expect(payload.recent[0].ts).toBeGreaterThan(payload.recent[1].ts);
    });
});
