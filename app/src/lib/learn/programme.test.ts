import { describe, it, expect } from 'vitest';
import { PROGRAMME, ALL_STEPS, weekProgress, VERIFIED_COUNT, REFLECTIVE_COUNT } from './programme';
import { lessonBySlug } from './curriculum';
import { newPaperState } from '@/lib/paperEngine';
import type { VerifyContext } from './types';

const emptyCtx = (): VerifyContext => ({
    state: newPaperState(500_000, 0),
    quotes: {},
    observed: { symbols: [], markets: [] },
    rsi: () => null,
});

// The programme's honesty rests on two properties: a verified step cannot be faked, and
// a self-marked step is never presented as if the engine confirmed it.

describe('the paper-trading programme', () => {
    it('runs five weeks in order, each with an aim and a named trap', () => {
        expect(PROGRAMME).toHaveLength(5);
        expect(PROGRAMME.map((w) => w.n)).toEqual([1, 2, 3, 4, 5]);
        for (const w of PROGRAMME) {
            expect(w.steps.length, `week ${w.n}`).toBeGreaterThan(2);
            expect(w.aim.length).toBeGreaterThan(40);
            // The trap is the part that makes a week worth reading rather than skipping.
            expect(w.trap.length, `week ${w.n} trap`).toBeGreaterThan(60);
        }
    });

    it('has unique step ids', () => {
        const ids = ALL_STEPS.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('gives every VERIFIED step a predicate, and every reflective step none', () => {
        // A reflective step carrying a verifier would be checked AND tickable, which is
        // the ambiguity this split exists to remove.
        for (const s of ALL_STEPS) {
            if (s.kind === 'verified') expect(typeof s.verify, s.id).toBe('function');
            else expect(s.verify, s.id).toBeUndefined();
        }
        expect(VERIFIED_COUNT).toBeGreaterThan(REFLECTIVE_COUNT);
    });

    it('leaves every verified step INCOMPLETE on a fresh account, with an actionable hint', () => {
        // If any passed on an empty ledger it would be decoration rather than a check.
        for (const s of ALL_STEPS) {
            if (s.kind !== 'verified') continue;
            const r = s.verify!(emptyCtx());
            expect(r.done, `${s.id} should not pass on an empty account`).toBe(false);
            expect(r.hint.length, `${s.id} hint`).toBeGreaterThan(10);
        }
    });

    it('never throws on an empty account', () => {
        for (const s of ALL_STEPS) {
            if (s.kind === 'verified') expect(() => s.verify!(emptyCtx()), s.id).not.toThrow();
        }
    });

    it('points every lesson reference at a lesson that exists', () => {
        for (const s of ALL_STEPS) {
            if (!s.lesson) continue;
            expect(lessonBySlug(s.lesson), `${s.id} → ${s.lesson}`).toBeDefined();
        }
    });

    it('counts a week as done only when every step is', () => {
        const week = PROGRAMME[0];
        expect(weekProgress(week, emptyCtx(), {}).done).toBe(0);
        expect(weekProgress(week, emptyCtx(), {}).complete).toBe(false);

        // Self-marking every reflective step must NOT complete a week whose verified
        // steps are still outstanding — that is the whole point of the split.
        const allMarked = Object.fromEntries(week.steps.map((s) => [s.id, true]));
        const p = weekProgress(week, emptyCtx(), allMarked);
        expect(p.complete).toBe(false);
        expect(p.done).toBe(week.steps.filter((s) => s.kind === 'reflective').length);
    });
});
