#!/usr/bin/env node
// End-to-end suite entry point.
//
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... \
//   NODE_PATH=/path/to/node_modules node scripts/e2e.mjs
//
// Requires a dev server on BASE_URL (default http://localhost:3000) and Playwright
// supplied from somewhere — see the message harness.mjs prints when it cannot find it.
//
// These tests place REAL paper orders. That is intentional: the screenshots in
// docs/AUTOMATED-TRADING.md are generated from this run, and a walkthrough of an empty
// app would be a mockup rather than evidence.

import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const e2eDir = join(here, '..', 'app', 'e2e');

const { launch, login, run } = await import(pathToFileURL(join(e2eDir, 'harness.mjs')).href);

const specs = readdirSync(e2eDir).filter((f) => f.endsWith('.spec.mjs')).sort();
if (!specs.length) { console.error('no .spec.mjs files found in', e2eDir); process.exit(2); }

const { browser, page, errors } = await launch();
let failures = 1;
try {
    await login(page);
    console.log(`logged in, running ${specs.length} spec files`);
    for (const f of specs) {
        const mod = await import(pathToFileURL(join(e2eDir, f)).href);
        if (typeof mod.default === 'function') mod.default({ page, errors });
    }
    failures = await run();
} catch (err) {
    console.error('\nsuite aborted:', err.message);
} finally {
    await browser.close();
}
process.exit(failures ? 1 : 0);
