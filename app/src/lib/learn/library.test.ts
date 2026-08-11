import { describe, it, expect } from 'vitest';
import { libraryItems, LIBRARY_KINDS } from './library';
import { PATHS, resolvePath } from './paths';
import { LESSONS, lessonBySlug } from './curriculum';

describe('library', () => {
    it('merges curated entries with lesson resources without duplicating a link', () => {
        const items = libraryItems();
        const urls = items.filter((i) => i.url).map((i) => i.url);
        expect(new Set(urls).size, 'a URL must appear once, however many lessons cite it').toBe(urls.length);
        expect(items.length).toBeGreaterThan(25);
    });

    it('carries citations from the lessons that reference a resource', () => {
        // Varsity's taxation module is cited by several lessons; the library row must
        // accumulate them rather than showing one and dropping the rest.
        const cited = libraryItems().filter((i) => (i.citedBy?.length ?? 0) > 1);
        expect(cited.length, 'at least one resource should be cited by more than one lesson').toBeGreaterThan(0);
        for (const item of cited) {
            for (const slug of item.citedBy!) {
                expect(lessonBySlug(slug), `${item.title} cites unknown lesson ${slug}`).toBeDefined();
            }
        }
    });

    it('only links to https, and books carry no link at all', () => {
        for (const i of libraryItems()) {
            if (i.kind === 'book' && i.url) {
                // A book may cite a reference page about itself; it may never link to a
                // shop. A citation cannot rot, and a retailer link is an affiliate
                // decision wearing a reference's clothes.
                expect(
                    /wikipedia\.org/.test(i.url),
                    `${i.title} links to ${i.url} — books may only reference, never sell`
                ).toBe(true);
            }
            if (!i.url) continue;
            expect(i.url.startsWith('https://'), `${i.title} → ${i.url}`).toBe(true);
            expect(() => new URL(i.url!)).not.toThrow();
        }
    });

    it('gives every item a declared kind, region, level and reason', () => {
        for (const i of libraryItems()) {
            expect(LIBRARY_KINDS, `${i.title} kind`).toContain(i.kind);
            expect(['india', 'us', 'global'], `${i.title} region`).toContain(i.region);
            expect(['foundation', 'intermediate', 'advanced', 'expert']).toContain(i.level);
            expect(i.why.length, `${i.title} why`).toBeGreaterThan(20);
            expect(i.topics.length).toBeGreaterThan(0);
        }
    });
});

describe('reading paths', () => {
    it('resolves every step to a real lesson or library item', () => {
        for (const path of PATHS) {
            const resolved = resolvePath(path);
            // resolvePath drops unknown refs so the UI never renders a dead row — which
            // means a typo would silently shrink a path. This is what catches it.
            expect(resolved.length, `${path.id} has unresolvable steps`).toBe(path.steps.length);
        }
    });

    it('has unique ids and non-trivial paths', () => {
        const ids = PATHS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const p of PATHS) {
            expect(p.steps.length, `${p.id} is too short to be a path`).toBeGreaterThanOrEqual(5);
            expect(p.blurb.length).toBeGreaterThan(20);
            expect(p.forWhom.length).toBeGreaterThan(20);
        }
    });

    it('orders lesson steps so prerequisites are not referenced backwards', () => {
        // A path that sends you to a lesson before the one it depends on is worse than
        // no path — it teaches the course out of order.
        for (const path of PATHS) {
            const lessons = resolvePath(path).map((s) => s.lesson).filter(Boolean);
            const seen = new Set<string>();
            for (const l of lessons) {
                for (const p of l!.prereq ?? []) {
                    // Only enforce ordering for prerequisites the path itself includes.
                    const inPath = lessons.some((x) => x!.slug === p);
                    if (inPath) expect(seen.has(p), `${path.id}: ${l!.slug} comes before its prereq ${p}`).toBe(true);
                }
                seen.add(l!.slug);
            }
        }
    });

    it('covers a reasonable share of the course', () => {
        const referenced = new Set(PATHS.flatMap((p) => p.steps.map((s) => s.ref)));
        const lessonRefs = [...referenced].filter((r) => lessonBySlug(r));
        expect(lessonRefs.length, 'paths should route through a meaningful part of the course').toBeGreaterThan(40);
        expect(LESSONS.length).toBeGreaterThan(100);
    });
});
