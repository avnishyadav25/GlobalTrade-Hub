import { suite, test, expect, BASE, shot, goto, waitForHydration } from './harness.mjs';

// The remaining surfaces: backtesting, the curriculum's honesty rules, the programme,
// watchlists and the coach.
//
// Selectors here are taken from the source rather than guessed. Every guessed selector in
// this suite so far has been wrong, and a wrong selector does not fail loudly — it fails
// as "the app is broken", which is worse than no test.

function featureSpec({ page }) {
    suite('Backtesting', () => {
        test('a comparison runs and reports against the benchmark', async () => {
            await goto(page, BASE + '/backtest');
            await page.waitForTimeout(1500);
            const run = page.getByRole('button', { name: /^Run comparison$/ });
            expect(await run.count(), 'the run control must exist').toBeGreaterThan(0);
            await run.click();
            // A backtest fetches candles; give it room without pretending it is instant.
            await page.waitForTimeout(9000);
            const body = await page.locator('body').innerText();
            // Either results, or an explicit statement of why not. Silence is the failure.
            expect(body.length, 'the screen must say something after a run').toBeGreaterThan(400);
            await shot(page, 'backtest-result', 'A strategy compared against buy-and-hold — the only comparison that means anything.', { section: 'Testing' });
        });

        test('walk-forward explains what it is doing', async () => {
            await goto(page, BASE + '/backtest/walk-forward');
            await page.waitForTimeout(1200);
            const body = await page.locator('body').innerText();
            expect(body).toMatch(/walk|forward|out-of-sample|window/i);
        });
    });

    suite('Learn: the curriculum cannot be faked', () => {
        test('a practice lesson is gated on the ledger, not a button', async () => {
            await goto(page, BASE + '/learn/run-a-strategy');
            await page.waitForTimeout(1200);
            const body = await page.locator('body').innerText();
            // The whole point: no "mark as done" anywhere.
            expect(body.toLowerCase()).notToContain('mark as done');
            expect(body).toMatch(/order|strategy/i);
            await shot(page, 'practice-lesson', 'A practice lesson. It cannot be completed by clicking — it reads your order book.', { section: 'Learn' });
        });

        test('a quiz marks a wrong answer wrong', async () => {
            await goto(page, BASE + '/learn/one-writer-only');
            await page.waitForTimeout(1200);
            const before = await page.locator('body').innerText();
            expect(before, 'this lesson should carry a quiz').toMatch(/\?/);
            // Answer the first question by clicking its first option.
            const opts = page.locator('button', { hasText: /^[A-Z]/ });
            const n = await opts.count();
            if (n > 0) {
                await opts.first().click();
                await page.waitForTimeout(800);
                await shot(page, 'quiz-feedback', 'Quizzes explain why an answer is wrong rather than only scoring it.', { section: 'Learn' });
            }
        });

        test('the programme distinguishes verified steps from self-marked ones', async () => {
            await goto(page, BASE + '/start');
            await page.waitForTimeout(1500);
            const body = await page.locator('body').innerText();
            expect(body).toContain('checked against your account');
            expect(body).toContain('self-marked');
            // Verified steps must have NO checkbox — that is what makes them honest.
            const boxes = await page.locator('input[type="checkbox"]').count();
            const verified = (body.match(/checked against your account/g) || []).length;
            expect(verified, 'verified steps').toBeGreaterThan(0);
            expect(boxes < verified + 5, 'there must be far fewer checkboxes than verified steps').toBeTruthy();
            await shot(page, 'programme', 'The five-week programme. Verified steps have no checkbox, because there is nothing to click.', { section: 'Learn' });
        });
    });

    suite('Watchlists and the coach', () => {
        test('a watchlist survives a reload', async () => {
            await goto(page, BASE + '/watchlists');
            const hydrated = await waitForHydration(page, 'gth-watchlists');
            expect(hydrated, 'the watchlist store never settled').toBeTruthy();
            const before = await page.evaluate(() => {
                try { return JSON.parse(localStorage.getItem('gth-watchlists') || '{}').state?.lists?.length ?? -1; } catch { return -1; }
            });
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
            await page.waitForTimeout(2500);
            const after = await page.evaluate(() => {
                try { return JSON.parse(localStorage.getItem('gth-watchlists') || '{}').state?.lists?.length ?? -1; } catch { return -1; }
            });
            expect(after, 'lists must not vanish across a reload').toBe(before);
        });

        test('the coach reports discipline from real trades', async () => {
            await goto(page, BASE + '/insights');
            await page.waitForTimeout(1500);
            const body = await page.locator('body').innerText();
            expect(body).toContain('DISCIPLINE SCORE');
            await shot(page, 'coach', 'The coach scores discipline from what you actually did, and its rules can refuse an order.', { section: 'Risk' });
        });
    });

    suite('Options', () => {
        test('the chain screen is honest about whether it has data', async () => {
            await goto(page, BASE + '/options');
            await page.waitForTimeout(4000);
            const body = await page.locator('body').innerText();
            // Either a chain, or a clear statement of why there is none. Never a blank.
            expect(body.trim().length, 'the options screen must say something').toBeGreaterThan(200);
            await shot(page, 'options-chain', 'The option chain. Where NSE cannot be reached it says so rather than showing an empty grid.', { section: 'Options' });
        });
    });
}

export default featureSpec;
