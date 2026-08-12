import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';

const STATE = 'e2e/.auth/state.json';

/**
 * Log in once, through the real form, and save the session for every other spec.
 *
 * Deliberately NOT bypassed with an env flag. The auth path is an HMAC session cookie
 * signed by an env-configured super-admin and validated in edge middleware; a suite that
 * disabled it would be testing a configuration nobody runs.
 */
setup('authenticate', async ({ page }) => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    setup.skip(!email || !password, 'ADMIN_EMAIL / ADMIN_PASSWORD are not set in the environment.');

    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Middleware gates every page route, so landing anywhere but /auth means it worked.
    await expect(page).not.toHaveURL(/\/auth\//, { timeout: 30_000 });

    fs.mkdirSync('e2e/.auth', { recursive: true });
    await page.context().storageState({ path: STATE });
});
