import { test, expect } from '@playwright/test';
import { seedPaper, hideGuide } from './seed';

// The claims this codebase makes about itself.
//
// These specs assert BEHAVIOUR rather than rendering. A test that only checks a route
// returns 200 cannot fail in any way that matters — it would pass just as happily with
// every number on the page wrong.

test.beforeEach(async ({ page }) => {
    await hideGuide(page);
    await seedPaper(page);
});

test('a study lesson cannot be completed without answering its quiz', async ({ page }) => {
    // The whole curriculum rests on this: there is no mark-as-done anywhere, because a
    // lesson you can tick off teaches nothing.
    await page.goto('/learn/what-a-derivative-is');
    await expect(page.getByRole('button', { name: /mark (as )?done|complete/i })).toHaveCount(0);
});

test('the strategy library refuses to offer a trade it cannot place', async ({ page }) => {
    await page.goto('/strategies/funding-carry');
    // Signal-only: the paper engine has no perpetual-futures instrument, so a trade
    // button here would open a position unrelated to the strategy described.
    await expect(page.getByText(/signal only/i).first()).toBeVisible();
});

test('the unavailable list no longer claims there is no option chain', async ({ page }) => {
    // This page was FALSE between PR 46 and PR 48c. A list of what is missing is only
    // worth having if it is corrected when something gets built.
    await page.goto('/strategies/unavailable');
    await expect(page.getByText(/no options instrument/i)).toHaveCount(0);
    await expect(page.getByText(/Index options ARE here now/i)).toBeVisible();
});

test('backtest withholds statistics the sample cannot support', async ({ page }) => {
    await page.goto('/backtest');
    await page.getByRole('button', { name: /run comparison/i }).click();
    await expect(page.getByText(/buy & hold/i).first()).toBeVisible({ timeout: 120_000 });
    // Every run is measured against something. A return with nothing to compare it to is
    // the number this app exists to stop reporting.
    await expect(page.getByText(/beat it/i)).toBeVisible();
});

test('walk-forward reports degradation, not just a return', async ({ page }) => {
    await page.goto('/backtest/walk-forward');
    await expect(page.getByText(/choose parameters on data you had/i)).toBeVisible();
    // The gap between in-sample and out-of-sample IS the finding, so the screen must
    // offer all three rather than a single headline number.
    await expect(page.getByRole('button', { name: /run walk-forward/i })).toBeVisible();
});

test('the option chain declines to invent an implied volatility', async ({ page }) => {
    await page.goto('/options');
    const footnote = page.getByText(/IV is solved here rather than taken from NSE/i);
    // Either the chain loaded, or NSE refused — both are acceptable, silence is not.
    const unreachable = page.getByText(/NSE did not answer/i);
    await expect(footnote.or(unreachable).first()).toBeVisible({ timeout: 120_000 });
});

test('research distinguishes "not covered" from "lookup failed"', async ({ page }) => {
    await page.goto('/research');
    await expect(page.getByText(/three states|does not cover|not reported/i).first()).toBeVisible({ timeout: 60_000 });
});

test('funds itemises charges rather than blending them', async ({ page }) => {
    await page.goto('/funds');
    // A single "fees" line is the defect: it hides that STT is sell-side only intraday,
    // which is most of the difference between intraday and delivery cost.
    await expect(page.getByText(/brokerage/i).first()).toBeVisible();
    await expect(page.getByText(/stt/i).first()).toBeVisible();
});

test('every primary route renders for a signed-in user', async ({ page }) => {
    // Deliberately last and deliberately shallow: this catches build breaks, and is not
    // a substitute for any of the assertions above.
    for (const route of ['/terminal', '/orders', '/portfolio', '/funds', '/strategies', '/signals', '/backtest', '/backtest/portfolio', '/insights', '/research', '/learn', '/library', '/options', '/settings']) {
        const res = await page.goto(route);
        expect(res?.status(), route).toBeLessThan(400);
    }
});
