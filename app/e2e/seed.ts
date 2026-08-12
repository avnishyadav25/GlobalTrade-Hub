import type { Page } from '@playwright/test';

/**
 * Put the paper account into a known state before a spec runs.
 *
 * Writes the persisted blob directly rather than trading through the UI, so a spec that
 * is testing the Funds screen does not also depend on the order ticket working. The
 * shape must match what `migratePaperState` accepts — version 2, structurally complete.
 */
export async function seedPaper(page: Page, startingCash = 500_000) {
    await page.addInitScript(
        ([cash]) => {
            const state = {
                version: 2,
                account: {
                    baseCurrency: 'INR',
                    startingCash: cash,
                    cash,
                    reservedCash: 0,
                    realizedGross: 0,
                    feesPaid: 0,
                    fillCount: 0,
                    roundTrips: 0,
                    roundTripWins: 0,
                },
                positions: {},
                realizedBySymbol: {},
                orders: [],
                fills: [],
                fillsTruncated: false,
                seq: 0,
                createdAt: 0,
            };
            window.localStorage.setItem(
                'gth-paper',
                JSON.stringify({ state: { state, equityHistory: [cash], migrationNotice: null }, version: 2 })
            );
        },
        [startingCash] as const
    );
}

/** Turn the guided-companion overlay off so it cannot sit over what a spec is clicking. */
export async function hideGuide(page: Page) {
    await page.addInitScript(() => {
        window.localStorage.setItem('gth-learn', JSON.stringify({ state: { guideEnabled: false }, version: 1 }));
    });
}
