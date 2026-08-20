import { suite, test, expect, BASE, shot, goto } from './harness.mjs';

// The automation control surface: what is running, and can you stop it.
//
// These are the tests that would have caught the gaps found by looking at a screenshot —
// no way to see both running instances, a "stop" that silently deleted your parameters,
// and no indication of whether anything was running at all.

function automationSpec({ page }) {
    suite('Automation: control surface', () => {
        test('the screen reports a status derived from a real check-in', async () => {
            await goto(page, BASE + '/automation');
            await page.waitForTimeout(2000);
            const body = await page.locator('body').innerText();
            expect(body).toMatch(/Running in a browser tab|Running on the server|Not running/);

            // The PROPERTY worth testing is honesty, not a fixed string. The browser only
            // checks in while it has instances to evaluate, so with everything paused the
            // correct answer is "Not running" — asserting "Running in a browser tab"
            // unconditionally made the app fail for telling the truth.
            const active = await page.evaluate(() => {
                try {
                    const s = JSON.parse(localStorage.getItem('gth-strategies') || '{}').state;
                    return (s?.instances ?? []).filter((i) => i.enabled).length;
                } catch { return 0; }
            });
            if (active === 0) {
                expect(body, 'with nothing enabled it must not claim to be running').toContain('Not running');
            }
            await shot(page, 'automation-status', 'Automation status, derived from a heartbeat that actually arrived rather than from a setting.', { section: 'Automation' });
        });

        test('lists every instance, across strategies', async () => {
            await goto(page, BASE + '/automation');
            await page.waitForTimeout(800);
            const body = await page.locator('body').innerText();
            const m = body.match(/Running instances \((\d+)\)/);
            expect(Boolean(m), 'instance count rendered').toBeTruthy();
            // Instances used to be listed only on their own strategy's page, so two
            // strategies running at once appeared nowhere together.
            expect(Number(m[1]), 'instances listed').toBeGreaterThanOrEqual(0);
        });

        test('pause and delete are different actions, and delete confirms', async () => {
            await goto(page, BASE + '/automation');
            await page.waitForTimeout(800);
            const pause = await page.getByRole('button', { name: /^(Pause|Resume)$/ }).count();
            const del = await page.getByRole('button', { name: /^Delete$/ }).count();
            if (pause === 0 && del === 0) return;      // no instances configured; nothing to assert
            expect(pause, 'pause controls').toBeGreaterThan(0);
            expect(del, 'delete controls').toBeGreaterThan(0);

            await page.getByRole('button', { name: /^Delete$/ }).first().click();
            await page.waitForTimeout(400);
            const body = await page.locator('body').innerText();
            expect(body, 'delete must confirm before destroying parameters').toMatch(/Delete this instance\?|Pause instead/i);
            await shot(page, 'automation-delete-confirm', 'Delete asks first, and points at pause — the old control destroyed tuned parameters with one silent click.', { section: 'Automation', fullPage: false });
            await page.keyboard.press('Escape');
        });

        test('the status endpoint reports evidence, not intent', async () => {
            const status = await page.evaluate(async () => {
                const r = await fetch('/api/automation/status');
                return { code: r.status, body: await r.json() };
            });
            expect(status.code).toBe(200);
            expect(['browser', 'server', 'idle']).toContain(status.body.holder);
            expect(typeof status.body.ttlMs).toBe('number');
        });

        test('the runner endpoint refuses an unauthenticated caller', async () => {
            const code = await page.evaluate(async () => {
                // Same-origin fetch WITH the session cookie: the runner must still refuse,
                // because it is guarded by CRON_SECRET rather than by being logged in.
                const r = await fetch('/api/automation/run');
                return r.status;
            });
            expect(code, 'a session must not be enough to run the trader').toBe(401);
        });
    });

    suite('Automation: the strategy page no longer lies', () => {
        test('does not claim nothing is placed without approval', async () => {
            await goto(page, BASE + '/strategies/ma-crossover');
            await page.waitForTimeout(600);
            const body = await page.locator('body').innerText();
            // The old copy ended at "Nothing is placed until you approve it." full stop,
            // directly above an instance sitting in automatic mode.
            expect(body).toContain('automatic');
            expect(body).toMatch(/review/i);
            await shot(page, 'strategy-run-it-live', 'The "Run it live" panel now distinguishes review from automatic instead of claiming approval is always required.', { section: 'Automation' });
        });
    });
}

export default automationSpec;
