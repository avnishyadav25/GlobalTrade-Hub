import { suite, test, expect, BASE, shot, realErrors, goto } from './harness.mjs';

// Every route renders, authenticated, with no uncaught error and no error boundary.
//
// Cheap and broad: this is the layer that catches a page someone broke without noticing,
// which unit tests structurally cannot. It caught the Button.tsx casing bug the moment
// the build cache was cleared.

// Every route, with what the picture is meant to show. The smoke pass already visits
// all of them, so capturing here costs a screenshot rather than a page load.
const ROUTES = [
    ['/', 'The entry point, which redirects into the terminal.', 'Orientation'],
    ['/terminal', 'The terminal: live prices, chart and order ticket in one place.', 'Orientation'],
    ['/agents', 'LLM-backed agents, and the guardrails that bind every automated path.', 'Risk'],
    ['/alerts', 'Price alerts.', 'Orientation'],
    ['/automation', 'What is running, and whether anything is actually running it.', 'Automation'],
    ['/backtest', 'Comparing a strategy against buy-and-hold — the only comparison that means anything.', 'Testing'],
    ['/backtest/portfolio', 'Portfolio backtest across sleeves, with a correlation matrix.', 'Testing'],
    ['/backtest/walk-forward', 'Walk-forward: fit on one window, test on the next, repeatedly.', 'Testing'],
    ['/funds', 'Charges itemised. Brokerage, STT, exchange, SEBI, stamp duty and GST are different things.', 'Trading'],
    ['/holdings', 'Open positions and what closing them would realise.', 'Trading'],
    ['/insights', 'Coach rules and what they have refused.', 'Risk'],
    ['/learn', 'Sixteen tracks. Every practice lesson is verified against the ledger.', 'Learn'],
    ['/library', 'Reading list.', 'Learn'],
    ['/options', 'A live NIFTY/BANKNIFTY chain with solved Greeks and IV.', 'Options'],
    ['/orders', 'Every order, including refusals and the reason each was refused.', 'Trading'],
    ['/paper', 'The paper account itself.', 'Trading'],
    ['/portfolio', 'Positions, equity curve and the record so far.', 'Trading'],
    ['/research', 'Fundamentals, earnings and IPOs — each distinguishing "no data" from "not covered".', 'Research'],
    ['/scanner', 'Screening the universe.', 'Research'],
    ['/settings', 'Broker connections and keys. Secrets never reach the browser.', 'Orientation'],
    ['/signals', 'What strategies want to do, and what actually binds an automatic order.', 'Automation'],
    ['/start', 'The five-week programme. Twelve steps are checked against your ledger.', 'Learn'],
    ['/strategies', 'Twenty-four rule sets, each with where it makes money and where it loses it.', 'Strategy'],
    ['/strategies/unavailable', 'What is deliberately NOT built, and the honest reason for each.', 'Strategy'],
    ['/watchlists', 'Instruments you follow.', 'Orientation'],
];

const BROKEN = /This page could not be found|Something went wrong|Application error|Unhandled Runtime|Module not found/i;

function smokeSpec({ page, errors }) {
    suite('Smoke: every route renders', () => {
        for (const [route, caption, section] of ROUTES) {
            test(`${route} renders`, async () => {
                errors.length = 0;
                const res = await goto(page, BASE + route);
                expect(res?.status() ?? 0, `${route} status`).toBeGreaterThanOrEqual(200);
                expect(res.status() < 400, `${route} status ${res.status()}`).toBeTruthy();
                await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});

                const body = await page.locator('body').innerText();
                expect(BROKEN.test(body), `${route} rendered an error page`).toBeFalsy();
                if (route === '/') {
                    // The root is a pure redirect and has no content of its own. What
                    // matters is that it lands somewhere real.
                    expect(new URL(page.url()).pathname, 'root must redirect').notToContain('/auth/login');
                } else {
                    // A route that renders almost nothing is broken in a way a 200 hides.
                    expect(body.trim().length, `${route} body length`).toBeGreaterThan(120);
                }
                expect(realErrors(errors).join(' | '), `${route} console`).toBe('');

                // Capture only once the page has settled, so the walkthrough does not
                // show half-loaded skeletons.
                await page.waitForTimeout(900);
                await shot(page, route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-'), caption, { section });
            });
        }
    });
}

export default smokeSpec;
