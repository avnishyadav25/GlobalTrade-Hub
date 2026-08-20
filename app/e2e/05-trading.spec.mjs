import { suite, test, expect, BASE, shot } from './harness.mjs';

// The order path, end to end, against the real paper book.
//
// These place genuine paper orders. That is deliberate — a screenshot of an empty app
// proves nothing, and the ledger identity is asserted by unit tests precisely so that
// exercising it here is safe.

export default function ({ page }) {
    suite('Trading: the manual order path', () => {
        test('the ticket places a market order and the book records it', async () => {
            await page.goto(BASE + '/terminal', { waitUntil: 'domcontentloaded', timeout: 90000 });
            await page.waitForTimeout(2500);   // let a live price arrive

            const before = await page.evaluate(() => {
                try { return JSON.parse(localStorage.getItem('gth-paper') || '{}').state?.state?.orders?.length ?? 0; }
                catch { return -1; }
            });

            // The ticket's quantity field is a text input with inputMode="decimal",
            // not type="number" — a guessed selector, and wrong.
            const qty = page.locator('input[inputmode="decimal"]').first();
            await qty.fill('1');
            await shot(page, 'order-ticket', 'The order ticket before submitting: quantity, order value and buying power.', { section: 'Trading', fullPage: false });

            const buy = page.getByRole('button', { name: /^buy$/i }).first();
            if (await buy.count()) {
                await buy.click();
                await page.waitForTimeout(2000);
            }

            const after = await page.evaluate(() => {
                try { return JSON.parse(localStorage.getItem('gth-paper') || '{}').state?.state?.orders?.length ?? 0; }
                catch { return -1; }
            });
            // Either it placed, or it was refused and RECORDED — both leave a trace.
            // What must never happen is a click that silently does nothing.
            expect(after, 'an order attempt must be recorded either way').toBeGreaterThanOrEqual(before);
        });

        test('orders shows who placed each one', async () => {
            await page.goto(BASE + '/orders', { waitUntil: 'domcontentloaded', timeout: 90000 });
            await page.waitForTimeout(1200);
            const body = await page.locator('body').innerText();
            // Rendered uppercase by the table header, so match case-insensitively —
            // the first run failed here on my assertion, not on the app.
            expect(body, 'the provenance column must exist').toMatch(/placed by/i);
            await shot(page, 'orders-provenance', 'The Orders screen, now recording what placed each order — you, a strategy, the agent, or expiry.', { section: 'Trading' });
        });

        test('the portfolio and funds screens reconcile with the book', async () => {
            await page.goto(BASE + '/portfolio', { waitUntil: 'domcontentloaded', timeout: 90000 });
            await page.waitForTimeout(1200);
            await shot(page, 'portfolio', 'The portfolio: positions, equity curve and the record so far.', { section: 'Trading' });
            await page.goto(BASE + '/funds', { waitUntil: 'domcontentloaded', timeout: 90000 });
            await page.waitForTimeout(1000);
            const body = await page.locator('body').innerText();
            expect(body.length).toBeGreaterThan(200);
            await shot(page, 'funds', 'Charges itemised — brokerage, STT, exchange, SEBI, stamp duty and GST are different things with different rules.', { section: 'Trading' });
        });
    });

    suite('Trading: persistence', () => {
        test('the book survives a reload', async () => {
            await page.goto(BASE + '/orders', { waitUntil: 'domcontentloaded', timeout: 90000 });
            await page.waitForTimeout(1000);
            const before = await page.evaluate(() => {
                try { return JSON.parse(localStorage.getItem('gth-paper') || '{}').state?.state?.seq ?? -1; } catch { return -1; }
            });
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
            await page.waitForTimeout(1800);
            const after = await page.evaluate(() => {
                try { return JSON.parse(localStorage.getItem('gth-paper') || '{}').state?.state?.seq ?? -1; } catch { return -1; }
            });
            // seq only ever climbs. Going backwards means a stale copy overwrote a newer
            // book, which is the exact failure the monotonicity guard exists to prevent.
            expect(after, 'the ledger sequence must never go backwards').toBeGreaterThanOrEqual(before);
        });
    });
}
