import { describe, it, expect } from 'vitest';
import { planPoll, rotationCycles, type Cost } from './priority';

const allScarce = (): Cost => 'scarce';
const seq = (n: number, prefix = 'S') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe('planPoll — the hot tier', () => {
    it('always includes the selected symbol, positions, resting orders and alerts', () => {
        const plan = planPoll({
            selected: 'RELIANCE',
            positions: ['AAPL'],
            restingOrders: ['TSLA'],
            alerts: ['NVDA'],
            all: seq(200),
            costOf: allScarce,
            cursor: 0,
        });
        expect(plan.symbols.slice(0, 4)).toEqual(['RELIANCE', 'AAPL', 'TSLA', 'NVDA']);
    });

    it('keeps the hot tier in every cycle of a long rotation', () => {
        let cursor = 0;
        for (let cycle = 0; cycle < 10; cycle++) {
            const plan = planPoll({ selected: 'RELIANCE', all: seq(90), costOf: allScarce, cursor });
            expect(plan.symbols).toContain('RELIANCE');
            cursor = plan.cursor;
        }
    });

    it('charges a symbol once when it is both hot and on a list', () => {
        const plan = planPoll({
            selected: 'AAPL',
            positions: ['AAPL'],
            activeList: ['AAPL', 'TSLA'],
            all: ['AAPL'],
            costOf: allScarce,
            cursor: 0,
            scarceBudget: 5,
        });
        expect(plan.symbols.filter((s) => s === 'AAPL')).toHaveLength(1);
        expect(plan.symbols).toEqual(['AAPL', 'TSLA']);
    });

    it('polls nothing from the rotation when the hot tier alone exhausts the budget', () => {
        const plan = planPoll({
            positions: seq(5, 'P'),
            all: seq(10),
            costOf: allScarce,
            cursor: 0,
            scarceBudget: 5,
        });
        expect(plan.symbols).toEqual(seq(5, 'P'));
        expect(plan.deferred).toEqual(seq(10));
    });
});

describe('planPoll — rotation', () => {
    it('polls everything and defers nothing when the list fits the budget', () => {
        const plan = planPoll({ all: seq(10), costOf: allScarce, cursor: 0, scarceBudget: 18 });
        expect(plan.symbols).toEqual(seq(10));
        expect(plan.deferred).toEqual([]);
        expect(plan.cursor).toBe(0); // a full pass wraps back to the start
    });

    it('reaches every symbol within ceil(n / budget) cycles', () => {
        const symbols = seq(60);
        const budget = 18;
        const expected = rotationCycles(symbols.length, budget);
        expect(expected).toBe(4);

        const seen = new Set<string>();
        let cursor = 0;
        for (let i = 0; i < expected; i++) {
            const plan = planPoll({ all: symbols, costOf: allScarce, cursor, scarceBudget: budget });
            plan.symbols.forEach((s) => seen.add(s));
            cursor = plan.cursor;
        }
        expect(seen.size).toBe(symbols.length);
    });

    it('resumes exactly where it stopped, without skipping or repeating', () => {
        const symbols = seq(10);
        const first = planPoll({ all: symbols, costOf: allScarce, cursor: 0, scarceBudget: 4 });
        expect(first.symbols).toEqual(['S0', 'S1', 'S2', 'S3']);
        expect(first.cursor).toBe(4);

        const second = planPoll({ all: symbols, costOf: allScarce, cursor: first.cursor, scarceBudget: 4 });
        expect(second.symbols).toEqual(['S4', 'S5', 'S6', 'S7']);
        expect(second.cursor).toBe(8);

        const third = planPoll({ all: symbols, costOf: allScarce, cursor: second.cursor, scarceBudget: 4 });
        expect(third.symbols).toEqual(['S8', 'S9', 'S0', 'S1']); // wraps
    });

    it('accounts scarce and cheap budgets separately', () => {
        const costOf = (s: string): Cost => (s.startsWith('C') ? 'cheap' : 'scarce');
        const plan = planPoll({
            all: ['S0', 'C0', 'S1', 'C1', 'S2'],
            costOf,
            cursor: 0,
            scarceBudget: 2,
            cheapBudget: 10,
        });
        // Walks S0(scarce) C0(cheap) S1(scarce) C1(cheap) then stops at S2 — scarce spent.
        expect(plan.symbols).toEqual(['S0', 'C0', 'S1', 'C1']);
        expect(plan.deferred).toEqual(['S2']);
    });

    it('stops rather than skipping, so a blocked symbol is retried next cycle', () => {
        const costOf = (s: string): Cost => (s === 'S0' ? 'scarce' : 'cheap');
        const plan = planPoll({ all: ['S0', 'C1', 'C2'], costOf, cursor: 0, scarceBudget: 0, cheapBudget: 10 });
        expect(plan.symbols).toEqual([]);
        expect(plan.cursor).toBe(0); // still pointing at the blocked symbol
        expect(plan.deferred).toEqual(['S0', 'C1', 'C2']);
    });

    it('puts the active list ahead of the rest', () => {
        const plan = planPoll({
            activeList: ['B', 'C'],
            all: ['A', 'B', 'C', 'D'],
            costOf: allScarce,
            cursor: 0,
            scarceBudget: 2,
        });
        expect(plan.symbols).toEqual(['B', 'C']);
    });
});

describe('planPoll — robustness', () => {
    it('clamps a cursor left over from a longer list', () => {
        const plan = planPoll({ all: seq(3), costOf: allScarce, cursor: 97, scarceBudget: 1 });
        expect(plan.symbols).toEqual(['S1']); // 97 % 3 === 1
    });

    it('handles a negative or non-finite cursor', () => {
        expect(planPoll({ all: seq(3), costOf: allScarce, cursor: -1, scarceBudget: 1 }).symbols).toEqual(['S2']);
        expect(planPoll({ all: seq(3), costOf: allScarce, cursor: Number.NaN, scarceBudget: 1 }).symbols).toEqual(['S0']);
    });

    it('returns an empty plan for an empty universe', () => {
        expect(planPoll({ costOf: allScarce, cursor: 5 })).toEqual({ symbols: [], cursor: 0, deferred: [] });
    });

    it('dedupes and ignores blank entries', () => {
        const plan = planPoll({
            selected: '  ',
            all: ['AAPL', '', 'AAPL', '  TSLA  '],
            costOf: allScarce,
            cursor: 0,
        });
        expect(plan.symbols).toEqual(['AAPL', 'TSLA']);
    });
});

describe('rotationCycles', () => {
    it.each([
        [0, 18, 1],
        [18, 18, 1],
        [36, 18, 2],
        [60, 18, 4],
        [1, 18, 1],
    ])('%i symbols at budget %i takes %i cycles', (n, budget, expected) => {
        expect(rotationCycles(n, budget)).toBe(expected);
    });
});
