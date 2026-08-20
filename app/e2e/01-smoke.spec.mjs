import { suite, test, expect, BASE, shot, realErrors, goto } from './harness.mjs';

// Every route renders, authenticated, with no uncaught error and no error boundary.
//
// Cheap and broad: this is the layer that catches a page someone broke without noticing,
// which unit tests structurally cannot. It caught the Button.tsx casing bug the moment
// the build cache was cleared.

const ROUTES = [
    '/', '/terminal', '/agents', '/alerts', '/automation', '/backtest',
    '/backtest/portfolio', '/backtest/walk-forward', '/funds', '/holdings', '/insights',
    '/learn', '/library', '/options', '/orders', '/paper', '/portfolio', '/research',
    '/scanner', '/settings', '/signals', '/start', '/strategies',
    '/strategies/unavailable', '/watchlists',
];

const BROKEN = /This page could not be found|Something went wrong|Application error|Unhandled Runtime|Module not found/i;

export default function ({ page, errors }) {
    suite('Smoke: every route renders', () => {
        for (const route of ROUTES) {
            test(`${route} renders`, async () => {
                errors.length = 0;
                const res = await goto(page, BASE + route);
                expect(res?.status() ?? 0, `${route} status`).toBeGreaterThanOrEqual(200);
                expect(res.status() < 400, `${route} status ${res.status()}`).toBeTruthy();
                await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});

                const body = await page.locator('body').innerText();
                expect(BROKEN.test(body), `${route} rendered an error page`).toBeFalsy();
                // A route that renders almost nothing is broken in a way a 200 hides.
                expect(body.trim().length, `${route} body length`).toBeGreaterThan(120);
                expect(realErrors(errors).join(' | '), `${route} console`).toBe('');
            });
        }

        test('the terminal is worth a picture', async () => {
            await goto(page, BASE + '/terminal');
            await page.waitForTimeout(1500);
            await shot(page, 'terminal', 'The terminal: live prices, the chart, and the order ticket.', { section: 'Orientation' });
        });
    });
}
