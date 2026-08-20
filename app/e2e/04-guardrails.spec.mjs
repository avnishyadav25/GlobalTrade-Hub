import { suite, test, expect, BASE, shot, goto } from './harness.mjs';

// Guardrails: all eight reachable, and the copy honest about what they bind.

export default function ({ page }) {
    suite('Guardrails: reachable and honest', () => {
        test('all eight controls exist on the agents screen', async () => {
            await goto(page, BASE + '/agents');
            await page.waitForTimeout(800);
            const body = await page.locator('body').innerText();
            for (const label of [
                'MAX ORDER VALUE', 'MAX DAILY LOSS', 'MAX OPEN POSITIONS', 'MAX ORDERS / DAY',
                'MAX PER SYMBOL', 'SQUARE-OFF BUFFER', 'MIN CONFIDENCE', 'TRADE ONLY WHEN OPEN',
            ]) {
                expect(body, `guardrail "${label}" must be settable`).toContain(label);
            }
            await shot(page, 'guardrails', 'All eight guardrails. Four of these were enforced but had no control at all until recently.', { section: 'Risk' });
        });

        test('says the caps bind every automated path', async () => {
            await goto(page, BASE + '/agents');
            const body = await page.locator('body').innerText();
            expect(body).toMatch(/every automated path/i);
            // minConfidence is meaningless for a rule-based signal and must say so.
            expect(body).toMatch(/AI ONLY/i);
        });

        test('a guardrail survives a reload', async () => {
            // The bug this pins: cloud sync replaced the guardrail object wholesale with
            // the server's copy, so any cap the stored row predated reverted on reload.
            await goto(page, BASE + '/agents');
            await page.waitForTimeout(800);
            const box = page.locator('input[type="checkbox"]').first();
            const before = await box.isChecked();
            await box.setChecked(!before);
            await page.waitForTimeout(1200);
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
            await page.waitForTimeout(1500);
            const after = await page.locator('input[type="checkbox"]').first().isChecked();
            expect(after, 'the toggle must survive a reload').toBe(!before);
            // put it back
            await page.locator('input[type="checkbox"]').first().setChecked(before);
            await page.waitForTimeout(800);
        });

        test('signals explains that exits are never blocked', async () => {
            await goto(page, BASE + '/signals');
            const body = await page.locator('body').innerText();
            expect(body).toMatch(/closing a position|stop you closing/i);
            await shot(page, 'signals', 'The signal queue, and what actually binds an automatic order.', { section: 'Risk' });
        });
    });
}
