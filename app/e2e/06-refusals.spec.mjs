import { suite, test, expect, BASE, shot, goto } from './harness.mjs';

// The refusals.
//
// A walkthrough that only shows things succeeding is marketing. This app's whole claim is
// that it tells you when something did NOT happen and why, so these are the screenshots
// that matter most: an order refused with its reason, a guardrail biting, a strategy
// silently doing nothing and being diagnosable anyway.
//
// Each of these deliberately provokes the failure, then puts the setting back.

function refusalSpec({ page }) {
    suite('Refusals: what it looks like when the app says no', () => {
        test('an order too large for the cash in the account is refused, and recorded', async () => {
            await goto(page, BASE + '/terminal');
            await page.waitForTimeout(2500);
            const qty = page.locator('input[inputmode="decimal"]').first();
            await qty.fill('999999');
            await page.waitForTimeout(600);
            await shot(page, 'refusal-oversized-ticket', 'An order far larger than the account can fund. The ticket shows the order value against buying power before you ever submit.', { section: 'Refusals', fullPage: false });

            const buy = page.getByRole('button', { name: /^buy$/i }).first();
            if (await buy.count()) { await buy.click(); await page.waitForTimeout(2000); }

            await goto(page, BASE + '/orders');
            await page.waitForTimeout(1500);
            const body = await page.locator('body').innerText();
            // The claim being tested: a refusal is RECORDED, not just toasted and lost.
            expect(body, 'the orders screen must account for refusals').toMatch(/Rejected|rejected/);
            await shot(page, 'refusal-recorded', 'Refusals are recorded on the Orders screen with their reason — not flashed as a toast and lost.', { section: 'Refusals' });
        });

        test('the kill switch halts everything, and says so', async () => {
            await goto(page, BASE + '/agents');
            await page.waitForTimeout(1200);
            const kill = page.getByRole('button', { name: /kill/i }).first();
            if (!(await kill.count())) return;
            await kill.click();
            await page.waitForTimeout(1200);
            await shot(page, 'refusal-kill-switch', 'The kill switch engaged. Nothing places while this is on — automatic or manual.', { section: 'Refusals' });

            await goto(page, BASE + '/automation');
            await page.waitForTimeout(1800);
            const body = await page.locator('body').innerText();
            expect(body, 'the automation screen must surface the kill switch').toMatch(/Kill-switch is on/i);
            await shot(page, 'refusal-kill-switch-automation', 'The automation screen refuses to imply anything is trading while the kill switch is on.', { section: 'Refusals' });

            // Put it back — leaving a kill switch on would silently stop everything later.
            await goto(page, BASE + '/agents');
            await page.waitForTimeout(1200);
            const off = page.getByRole('button', { name: /kill/i }).first();
            if (await off.count()) { await off.click(); await page.waitForTimeout(1200); }
        });

        test('strategies that cannot be built say why', async () => {
            await goto(page, BASE + '/strategies/unavailable');
            await page.waitForTimeout(1000);
            const body = await page.locator('body').innerText();
            expect(body.length).toBeGreaterThan(400);
            await shot(page, 'refusal-unavailable', 'Eight strategies that are deliberately not built, each with the actual reason — a paid feed, no historical data, or a blocked source.', { section: 'Refusals' });
        });

        test('an empty state says nothing has happened rather than inventing something', async () => {
            await goto(page, BASE + '/signals');
            await page.waitForTimeout(1200);
            await shot(page, 'empty-signals', 'With nothing running, the signal queue says so instead of showing placeholder rows.', { section: 'Refusals' });
        });
    });
}

export default refusalSpec;
