// A very small test harness.
//
// The project's own @playwright/test has never installed here — five attempts, all
// timing out against the registry — so the suite runs on a separately-provided
// Playwright instead. That costs us the runner, the assertions and the reporter, which
// is what this file replaces. It is deliberately minimal: enough to express the tests
// honestly, and nothing more.
//
// If `npm i -D @playwright/test` ever succeeds, these specs port over almost verbatim:
// `suite`/`test` map to `describe`/`it`, and the expectations are a subset of theirs.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = process.env.BASE_URL || 'http://localhost:3000';
// Anchored to THIS FILE, not to cwd. Deriving it from cwd wrote the first run's
// screenshots to a docs/ folder outside the repository entirely, because the suite is
// launched from the repo root rather than from app/.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SHOTS = process.env.SHOT_DIR || join(REPO_ROOT, 'docs', 'screenshots');

let chromium;
try {
    ({ chromium } = await import('playwright'));
} catch {
    // ESM ignores NODE_PATH — that is a CommonJS resolution feature. So fall back to
    // CJS resolution, which does consult it, and import whatever path that yields.
    // Without this, `NODE_PATH=... node suite.mjs` fails in a way that looks like
    // Playwright is missing when it is sitting right there.
    try {
        const { createRequire } = await import('node:module');
        const { pathToFileURL } = await import('node:url');
        const req = createRequire(import.meta.url);
        const entry = process.env.PLAYWRIGHT_PATH
            ? req.resolve(process.env.PLAYWRIGHT_PATH)
            : req.resolve('playwright');
        // Playwright's entry is CommonJS. Importing CJS from ESM does not reliably
        // expose named exports, so `{ chromium }` can destructure to undefined without
        // throwing — which looks identical to "not installed". Take the default too.
        const mod = await import(pathToFileURL(entry).href);
        chromium = mod.chromium ?? mod.default?.chromium;
    } catch (err) {
        if (process.env.E2E_DEBUG) console.error('playwright fallback failed:', err);
    }
}

if (!chromium) {
    console.error(
        '\nCannot find Playwright.\n\n' +
        'This project does not have @playwright/test installed — installs have failed\n' +
        'repeatedly from this machine. Supply Playwright one of two ways:\n\n' +
        '  1. npm i -D @playwright/test        (from a machine that can reach the registry)\n' +
        '  2. NODE_PATH=/path/to/node_modules  (any install that exposes `playwright`)\n' +
        '  3. PLAYWRIGHT_PATH=/path/to/node_modules/playwright\n'
    );
    process.exit(2);
}

/* --------------------------------------------------------------- registry */

const suites = [];
let current = null;

export function suite(name, fn) {
    current = { name, tests: [] };
    suites.push(current);
    fn();
    current = null;
}

export function test(name, fn) {
    if (!current) throw new Error(`test("${name}") declared outside a suite`);
    current.tests.push({ name, fn });
}

/* ------------------------------------------------------------ assertions */

class Expectation {
    constructor(actual, label) { this.actual = actual; this.label = label; }
    #fail(msg) { throw new Error(`${this.label ? this.label + ': ' : ''}${msg}`); }

    toBe(expected) {
        if (this.actual !== expected) this.#fail(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(this.actual)}`);
    }
    toEqual(expected) {
        if (JSON.stringify(this.actual) !== JSON.stringify(expected)) {
            this.#fail(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(this.actual)}`);
        }
    }
    toContain(needle) {
        if (!String(this.actual).includes(needle)) {
            this.#fail(`expected to contain ${JSON.stringify(needle)}\n    in: ${String(this.actual).slice(0, 400)}`);
        }
    }
    notToContain(needle) {
        if (String(this.actual).includes(needle)) this.#fail(`expected NOT to contain ${JSON.stringify(needle)}`);
    }
    toBeGreaterThan(n) {
        if (!(this.actual > n)) this.#fail(`expected > ${n}, got ${this.actual}`);
    }
    toBeGreaterThanOrEqual(n) {
        if (!(this.actual >= n)) this.#fail(`expected >= ${n}, got ${this.actual}`);
    }
    toBeTruthy() { if (!this.actual) this.#fail(`expected truthy, got ${JSON.stringify(this.actual)}`); }
    toBeFalsy() { if (this.actual) this.#fail(`expected falsy, got ${JSON.stringify(this.actual)}`); }
    toMatch(re) {
        if (!re.test(String(this.actual))) this.#fail(`expected to match ${re}\n    in: ${String(this.actual).slice(0, 400)}`);
    }
}
export const expect = (actual, label) => new Expectation(actual, label);

/* ------------------------------------------------------------ screenshots */

let shotSeq = 0;
const manifest = [];

/**
 * Capture a step.
 *
 * Screenshots are numbered in capture order so the walkthrough reads as a sequence, and
 * every one records the caption alongside it — a screenshot with no statement of what to
 * look at is decoration rather than evidence.
 */
export async function shot(page, slug, caption, opts = {}) {
    mkdirSync(SHOTS, { recursive: true });
    const n = String(++shotSeq).padStart(2, '0');
    const file = `${n}-${slug}.png`;
    await page.screenshot({ path: join(SHOTS, file), fullPage: opts.fullPage !== false });
    manifest.push({ file, slug, caption, section: opts.section ?? 'General' });
    return file;
}

export function screenshotManifest() { return manifest; }

/* ---------------------------------------------------------------- browser */

export async function launch() {
    const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    // Generous, because a page here can block on a market-data provider that is
    // throttling us. A slow page is not a broken page, and a run that reports nine
    // timeouts as nine bugs is worse than no run at all.
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(90_000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    return { browser, context, page, errors };
}

export async function login(page) {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD must be in the environment');
    await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' });
    await page.waitForSelector('form button', { state: 'visible' });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    // The submit button carries no type attribute — inside a form it still submits, but
    // `button[type=submit]` does not match it. That cost a whole run of false passes once.
    await page.click('form button');
    await page.waitForURL((u) => !new URL(u).pathname.startsWith('/auth/login'), { timeout: 20000 });
}

/** Noise that is not this app's fault and would fail every page. */
const IGNORED = [
    /favicon/i, /React DevTools/i, /Extra attributes from the server/i,
    /binance|websocket|wss:/i, /ERR_INTERNET_DISCONNECTED/i,
    // In-flight state writes aborted by a redirect — an artefact of navigation, not a bug.
    /api\/state\/\w+.*(ERR_ABORTED|aborted)/i,
];
export const realErrors = (errors) => errors.filter((e) => !IGNORED.some((re) => re.test(e)));

/**
 * Navigate, retrying ONCE on a timeout.
 *
 * Pages here can block on a market-data provider that is rate-limiting us, and a run that
 * reports three 90-second navigation timeouts as three broken pages is worse than no run:
 * it buries the real signal in noise you then learn to ignore.
 *
 * Deliberately narrow. Only a timeout is retried — an error page, a bad status or a
 * console error is a real result and is never retried away. Retries are reported, because
 * a page that needs two attempts is worth knowing about even when it passes.
 */
export async function goto(page, url, opts = {}) {
    try {
        return await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000, ...opts });
    } catch (err) {
        if (!/Timeout/i.test(String(err.message))) throw err;
        retried.push(url);
        console.log(`        (slow: retrying ${url})`);
        return await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000, ...opts });
    }
}

const retried = [];
export const retriedNavigations = () => retried;

/* ----------------------------------------------------------------- runner */

export async function run() {
    const only = process.env.ONLY;
    let passed = 0;
    const failures = [];
    const started = Date.now();

    for (const s of suites) {
        if (only && !s.name.toLowerCase().includes(only.toLowerCase())) continue;
        console.log(`\n${s.name}`);
        for (const t of s.tests) {
            try {
                await t.fn();
                passed++;
                console.log(`  ok    ${t.name}`);
            } catch (err) {
                failures.push({ suite: s.name, test: t.name, error: err });
                console.log(`  FAIL  ${t.name}`);
                console.log(`        ${String(err.message).split('\n').join('\n        ')}`);
            }
        }
    }

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n${passed} passed, ${failures.length} failed  (${secs}s)`);
    if (retried.length) {
        console.log(`${retried.length} navigation(s) needed a retry — the market-data provider was throttling:`);
        for (const u of [...new Set(retried)]) console.log(`  slow: ${u}`);
    }
    if (manifest.length) {
        writeFileSync(join(SHOTS, 'manifest.json'), JSON.stringify(manifest, null, 1));
        console.log(`${manifest.length} screenshots -> ${SHOTS}`);
    }
    return failures.length;
}
