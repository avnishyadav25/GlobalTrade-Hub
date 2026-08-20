import { suite, test, expect, BASE, shot, goto, waitForHydration } from './harness.mjs';

// Guardrails: all eight reachable, and the copy honest about what they bind.

function guardrailSpec({ page }) {
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
            // Settle BEFORE touching anything: a change made mid-hydration is accepted
            // by the UI and then overwritten, which looks exactly like a persistence bug.
            const hydrated = await waitForHydration(page, 'gth-agents');
            expect(hydrated, 'the agents store never settled').toBeTruthy();
            const box = page.locator('input[type="checkbox"]').first();
            const before = await box.isChecked();

            // Click until the UI ACCEPTS the change, then test persistence separately.
            //
            // Playwright can set the DOM property before React has hydrated, so no
            // handler fires and the next render puts it straight back. That failed this
            // test as "the toggle did not survive a reload" when the toggle had never
            // been applied in the first place — two different failures reported as one,
            // and the wrong one.
            let accepted = false;
            for (let attempt = 0; attempt < 10 && !accepted; attempt++) {
                await box.setChecked(!before);
                await page.waitForTimeout(400);
                accepted = (await box.isChecked()) === !before;
            }
            expect(accepted, 'the UI never accepted the toggle — hydration, not persistence').toBeTruthy();
            // Wait for the SERVER to confirm the new value rather than guessing at the
            // 1500ms cloudSync debounce. A fixed delay made this test report a bug that
            // depended on which way the toggle happened to be going.
            let confirmed = false;
            for (let i = 0; i < 20 && !confirmed; i++) {
                await page.waitForTimeout(500);
                confirmed = await page.evaluate(async (want) => {
                    const r = await fetch('/api/state/agents');
                    const j = await r.json();
                    return j?.value?.guardrails?.tradeOnlyWhenOpen === want;
                }, !before);
            }
            expect(confirmed, 'the change never reached the server').toBeTruthy();
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
            await page.waitForTimeout(2500);
            const after = await page.locator('input[type="checkbox"]').first().isChecked();
            expect(after, 'the toggle must survive a reload').toBe(!before);
            // put it back
            await page.locator('input[type="checkbox"]').first().setChecked(before);
            await page.waitForTimeout(2000);   // let the restore persist too
        });

        test('signals explains that exits are never blocked', async () => {
            await goto(page, BASE + '/signals');
            const body = await page.locator('body').innerText();
            expect(body).toMatch(/closing a position|stop you closing/i);
            await shot(page, 'signals', 'The signal queue, and what actually binds an automatic order.', { section: 'Risk' });
        });
    });
}

export default guardrailSpec;
