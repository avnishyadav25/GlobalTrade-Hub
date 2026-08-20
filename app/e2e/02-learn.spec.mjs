import { suite, test, expect, BASE, shot, goto } from './harness.mjs';

// Every lesson renders WITH its visual.
//
// Measured on the <figure> the Frame helper emits, not on <svg>: only 6 of the 13
// archetypes use SVG at all, and counting those once reported 68 of 117 lessons as
// visual-less when every one of them was fine. A visual whose key resolves to nothing
// renders a figure that collapses to near-zero height, which is the failure worth
// hunting and the one no unit test can see.

const MIN_FIGURE_HEIGHT = 40;

export default function ({ page }) {
    let lessons = [];

    suite('Learn: every lesson and its visual', () => {
        test('discovers lessons by crawling the tracks, not from a hardcoded list', async () => {
            await goto(page, BASE + '/learn');
            const tracks = await page.locator('a[href^="/learn/track/"]').evaluateAll(
                (els) => [...new Set(els.map((e) => e.getAttribute('href')))]);
            expect(tracks.length, 'tracks found').toBeGreaterThanOrEqual(16);

            const found = new Set();
            for (const t of tracks) {
                await page.goto(BASE + t, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(150);
                (await page.locator('a[href^="/learn/"]').evaluateAll((els) =>
                    els.map((e) => e.getAttribute('href'))
                       .filter((h) => h && !h.startsWith('/learn/track') && h !== '/learn')))
                    .forEach((h) => found.add(h));
            }
            lessons = [...found].sort();
            expect(lessons.length, 'lessons discovered').toBeGreaterThanOrEqual(129);
        });

        test('every lesson renders a visual with real height', async () => {
            const noFigure = [];
            const collapsed = [];
            for (const href of lessons) {
                await goto(page, BASE + href);
                await page.waitForTimeout(220);   // let the intersection observer mount it
                const figs = await page.locator('figure').all();
                if (!figs.length) { noFigure.push(href); continue; }
                let tallest = 0;
                for (const f of figs) {
                    const box = await f.boundingBox().catch(() => null);
                    if (box && box.height > tallest) tallest = box.height;
                }
                if (tallest < MIN_FIGURE_HEIGHT) collapsed.push(`${href} (${Math.round(tallest)}px)`);
            }
            expect(noFigure.join(', '), 'lessons with no visual').toBe('');
            expect(collapsed.join(', '), 'lessons with a collapsed visual').toBe('');
        });

        test('the automation track is reachable and teaches the lease', async () => {
            await goto(page, BASE + '/learn/one-writer-only');
            const body = await page.locator('body').innerText();
            expect(body).toContain('lease');
            await shot(page, 'learn-lease', 'A lesson explaining why only one runner may write the ledger.', { section: 'Learn' });
        });
    });
}
