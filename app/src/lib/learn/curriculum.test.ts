import { describe, it, expect } from 'vitest';
import { LESSONS, lessonBySlug, lessonsByTrack } from './curriculum';
import { TRACKS, LEVELS } from './types';
import { VISUAL_KEYS } from './visuals';
import { COACH_TOPICS } from './topics';
import { parseInline, parseBlocks } from './markdownLite';
import { newPaperState } from '@/lib/paperEngine';
import type { VerifyContext } from './types';

const tracksById = () => new Set(TRACKS.map((t) => t.id));

/** Routes that exist in app/. A lesson pointing anywhere else is a dead link. */
const ROUTES = new Set([
    '/terminal', '/orders', '/holdings', '/portfolio', '/funds', '/watchlists',
    '/alerts', '/scanner', '/insights', '/agents', '/settings', '/backtest', '/paper',
    '/learn', '/library', '/strategies', '/strategies/unavailable', '/signals', '/research',
]);

/** A fresh account with nothing done — every verifier must cope with this. */
const emptyCtx = (): VerifyContext => ({
    state: newPaperState(500_000, 0),
    quotes: {},
    observed: { symbols: [], markets: [] },
    rsi: () => null,
});

describe('curriculum integrity', () => {
    it('spans fifteen declared tracks and four levels', () => {
        expect(LESSONS.length).toBeGreaterThanOrEqual(16);
        expect(TRACKS).toHaveLength(15);
        expect(LEVELS).toHaveLength(4);
    });

    it('has unique slugs', () => {
        const slugs = LESSONS.map((l) => l.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('keeps the original ten slugs so existing progress survives the reshuffle', () => {
        // Reordering into modules must not silently reset anyone's completed lessons.
        for (const slug of [
            'what-you-are-looking-at', 'price-and-change', 'your-first-order',
            'quantity-and-buying-power', 'closing-a-trade', 'limit-orders', 'stops',
            'fees-and-slippage', 'shorting-and-margin', 'rules-that-bind',
        ]) {
            expect(lessonBySlug(slug), `${slug} must still exist`).toBeDefined();
        }
    });

    it('assigns every lesson to a declared track and level', () => {
        const tracks = new Set(TRACKS.map((t) => t.id));
        const levels = new Set(LEVELS.map((l) => l.key));
        for (const l of LESSONS) {
            expect(tracks.has(l.track), `${l.slug} track "${l.track}"`).toBe(true);
            expect(levels.has(l.level), `${l.slug} level "${l.level}"`).toBe(true);
        }
    });

    it('never lists a track that has no lessons as though it did', () => {
        // Empty tracks are allowed while the course is being written — the UI says so
        // rather than showing a placeholder. But whatever IS grouped must be reachable.
        const grouped = lessonsByTrack();
        for (const [track, lessons] of grouped) {
            expect(tracksById().has(track), `unknown track ${track}`).toBe(true);
            expect(lessons.length).toBeGreaterThan(0);
        }
    });

    it('gives every practice lesson an exercise and every study lesson a quiz', () => {
        for (const l of LESSONS) {
            if (l.kind === 'practice') {
                expect(l.exercise, `${l.slug} is practice but has no exercise`).toBeDefined();
                expect(typeof l.exercise?.verify).toBe('function');
            } else {
                // A study lesson is verified BY its quiz, so an empty one could never
                // be completed.
                expect(l.quiz.length, `${l.slug} is study but has no questions`).toBeGreaterThan(0);
            }
        }
    });

    it('resolves every prerequisite to a real, EARLIER lesson', () => {
        const index = new Map(LESSONS.map((l, i) => [l.slug, i]));
        for (const l of LESSONS) {
            for (const p of l.prereq ?? []) {
                expect(index.has(p), `${l.slug} → unknown prereq ${p}`).toBe(true);
                // A prerequisite that comes later would make the course unfollowable.
                expect(index.get(p)!, `${l.slug} → prereq ${p} comes later`).toBeLessThan(index.get(l.slug)!);
            }
        }
    });

    it('points every lesson at a route that exists', () => {
        for (const l of LESSONS) {
            expect(ROUTES.has(l.where.href), `${l.slug} → ${l.where.href}`).toBe(true);
            expect(l.where.label.length).toBeGreaterThan(0);
        }
    });

    it('resolves every visual to a registered animation', () => {
        for (const l of LESSONS) {
            if (!l.visual) continue;
            expect(VISUAL_KEYS as readonly string[], `${l.slug} → ${l.visual}`).toContain(l.visual);
        }
    });

    it('has a well-formed quiz on every lesson', () => {
        for (const l of LESSONS) {
            expect(l.quiz.length, `${l.slug} has no quiz`).toBeGreaterThan(0);
            for (const q of l.quiz) {
                expect(q.options.length).toBeGreaterThanOrEqual(2);
                expect(q.answer).toBeGreaterThanOrEqual(0);
                expect(q.answer, `${l.slug}: answer index out of range`).toBeLessThan(q.options.length);
                expect(q.why.length).toBeGreaterThan(10);
            }
        }
    });

    it('gives every lesson an outcome, concept body and exercise', () => {
        for (const l of LESSONS) {
            expect(l.outcome.length, `${l.slug} outcome`).toBeGreaterThan(10);
            expect(l.concept.length, `${l.slug} concept`).toBeGreaterThan(0);
            if (l.exercise) {
                expect(l.exercise.title.length).toBeGreaterThan(0);
                expect(typeof l.exercise.verify).toBe('function');
            }
            expect(l.minutes).toBeGreaterThan(0);
        }
    });

    it('only links to https, never http or a bare string', () => {
        for (const l of LESSONS) {
            for (const r of l.resources ?? []) {
                if (!r.url) continue; // books legitimately have none
                expect(r.url.startsWith('https://'), `${l.slug} → ${r.url}`).toBe(true);
                expect(() => new URL(r.url!)).not.toThrow();
            }
        }
    });

    it('gives every drill a positive target and a counter', () => {
        for (const l of LESSONS) {
            for (const d of l.drills ?? []) {
                expect(d.target).toBeGreaterThan(0);
                expect(typeof d.count).toBe('function');
                expect(d.count(emptyCtx()), `${d.id} should start at 0`).toBe(0);
            }
        }
    });
});

describe('verifiers on a fresh account', () => {
    it('every exercise is incomplete and gives an actionable hint', () => {
        for (const l of LESSONS) {
            if (!l.exercise) continue;   // study lessons are quiz-verified
            const r = l.exercise.verify(emptyCtx());
            expect(r.done, `${l.slug} should not pass on an empty account`).toBe(false);
            expect(r.hint.length, `${l.slug} hint`).toBeGreaterThan(10);
            if (r.progress != null) {
                expect(r.progress).toBeGreaterThanOrEqual(0);
                expect(r.progress).toBeLessThanOrEqual(1);
            }
        }
    });

    it('no verifier or drill counter throws on an empty account', () => {
        for (const l of LESSONS) {
            if (l.exercise) expect(() => l.exercise!.verify(emptyCtx()), l.slug).not.toThrow();
            for (const d of l.drills ?? []) expect(() => d.count(emptyCtx()), d.id).not.toThrow();
            for (const f of l.formulas ?? []) expect(() => f.worked?.(emptyCtx()), f.label).not.toThrow();
        }
    });
});

describe('coach topics', () => {
    it('covers every screen and survives an empty account', () => {
        for (const [key, topic] of Object.entries(COACH_TOPICS)) {
            expect(topic.cards.length, `${key} has no cards`).toBeGreaterThan(0);
            expect(topic.blurb.length).toBeGreaterThan(5);
            for (const card of topic.cards) {
                expect(() => card.value?.(emptyCtx()), `${key} → ${card.title}`).not.toThrow();
            }
        }
    });

    it('only points at lessons that exist', () => {
        for (const [key, topic] of Object.entries(COACH_TOPICS)) {
            if (!topic.lesson) continue;
            expect(lessonBySlug(topic.lesson), `${key} → ${topic.lesson}`).toBeDefined();
        }
    });
});

describe('markdown-lite', () => {
    it('parses bold, code and links', () => {
        expect(parseInline('a **b** c')).toEqual([
            { kind: 'text', text: 'a ' },
            { kind: 'bold', text: 'b' },
            { kind: 'text', text: ' c' },
        ]);
        expect(parseInline('run `npm test`')).toEqual([
            { kind: 'text', text: 'run ' },
            { kind: 'code', text: 'npm test' },
        ]);
    });

    it('distinguishes internal routes from external links', () => {
        expect(parseInline('[Funds](/funds)')).toEqual([
            { kind: 'link', text: 'Funds', href: '/funds', external: false },
        ]);
        expect(parseInline('[Varsity](https://zerodha.com/varsity/)')).toEqual([
            { kind: 'link', text: 'Varsity', href: 'https://zerodha.com/varsity/', external: true },
        ]);
    });

    it('leaves unmatched markers as plain text', () => {
        expect(parseInline('2 * 3 * 4')).toEqual([{ kind: 'text', text: '2 * 3 * 4' }]);
        expect(parseInline('[not a link')).toEqual([{ kind: 'text', text: '[not a link' }]);
    });

    it('groups bullets, quotes and paragraphs', () => {
        const blocks = parseBlocks('intro\n- one\n- two\n> note\ntail');
        expect(blocks.map((b) => b.kind)).toEqual(['p', 'ul', 'quote', 'p']);
        expect((blocks[1] as { items: unknown[] }).items).toHaveLength(2);
    });

    it('ignores blank lines and trailing whitespace', () => {
        expect(parseBlocks('\n\n  hello  \n\n')).toEqual([{ kind: 'p', content: [{ kind: 'text', text: 'hello' }] }]);
    });
});
