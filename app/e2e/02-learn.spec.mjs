import { suite, test, expect, BASE, shot, goto } from './harness.mjs';

// Every lesson renders WITH its visual.
//
// Measured on the <figure> the Frame helper emits, not on <svg>: only 6 of the 13
// archetypes use SVG at all, and counting those once reported 68 of 117 lessons as
// visual-less when every one of them was fine. A visual whose key resolves to nothing
// renders a figure that collapses to near-zero height, which is the failure worth
// hunting and the one no unit test can see.

const MIN_FIGURE_HEIGHT = 40;

function learnSpec({ page }) {
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

            // SAMPLE BY DEFAULT, exhaustive on demand.
            //
            // Walking all 135 lessons took 63 minutes and left the market-data provider
            // throttling us, which then failed three unrelated tests. A check you cannot
            // afford to run is not a check — it just makes the suite something people
            // skip. One lesson per track still catches a broken archetype or a visual key
            // that resolves to nothing, which is what this is actually guarding.
            //
            //   E2E_ALL_LESSONS=1  walks every lesson (slow, and hard on the provider)
            const sample = process.env.E2E_ALL_LESSONS === '1'
                ? lessons
                : [...new Map(lessons.map((h) => [h.split('/')[2]?.[0] ?? h, h])).values()];
            console.log(`        checking ${sample.length} of ${lessons.length} lessons${sample.length < lessons.length ? ' (set E2E_ALL_LESSONS=1 for all)' : ''}`);

            for (const href of sample) {
                await goto(page, BASE + href);

                // Poll for the figure to EXIST as well as to have height. Checking
                // existence once, immediately after navigation, reported /learn/the-greeks
                // as having no visual at all — it renders reliably at 146px when given a
                // moment. Two different waits were needed and only one was there.
                let figs = [];
                for (let attempt = 0; attempt < 12 && figs.length === 0; attempt++) {
                    figs = await page.locator('figure').all();
                    if (!figs.length) await page.waitForTimeout(250);
                }
                if (!figs.length) { noFigure.push(href); continue; }

                // POLL until the figure has settled, rather than measuring at a fixed
                // instant. A visual mounts via an intersection observer and the server
                // can be slow, so a single 220ms sample reported eleven lessons as
                // having a 0px visual when every one of them rendered fine — a false
                // alarm that would have sent someone hunting a bug that was not there.
                let tallest = 0;
                for (let attempt = 0; attempt < 12 && tallest < MIN_FIGURE_HEIGHT; attempt++) {
                    await page.waitForTimeout(250);
                    for (const f of figs) {
                        const box = await f.boundingBox().catch(() => null);
                        if (box && box.height > tallest) tallest = box.height;
                    }
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

export default learnSpec;
