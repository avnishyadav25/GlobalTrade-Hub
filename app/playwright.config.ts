import { defineConfig, devices } from '@playwright/test';

// Browser tests for GlobalTrade Hub.
//
// One setup project logs in through the REAL /auth/login form once and saves the
// session; every spec reuses it. That exercises the actual auth path — an HMAC session
// cookie signed by an env super-admin — without paying for a login per test, and without
// running the suite against a configuration we do not ship. Disabling auth for tests
// would test something nobody uses.
//
// `webServer` starts the dev server if one is not already up, so `npm run test:e2e` works
// from a cold checkout.

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
    testDir: './e2e',
    // The paper account is shared mutable state — parallel specs would trade over each
    // other's positions and the failures would be irreproducible.
    workers: 1,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? 'github' : 'list',

    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },

    projects: [
        { name: 'setup', testMatch: /auth\.setup\.ts/ },
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/state.json' },
            dependencies: ['setup'],
        },
    ],

    webServer: {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: true,
        // Next's first compile is slow, and market data providers are contacted on boot.
        timeout: 180_000,
    },
});
