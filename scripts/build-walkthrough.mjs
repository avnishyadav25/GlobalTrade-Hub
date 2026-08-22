#!/usr/bin/env node
// Build docs/AUTOMATED-TRADING.md from the screenshots the E2E suite captured.
//
// Generated rather than written by hand, so an image and its caption cannot drift from
// what the app actually did. Every screenshot here was taken during a real run against a
// real paper book — if a step is missing from the doc it is because the suite did not
// reach it, which is worth knowing.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'docs', 'screenshots');
const MANIFEST = join(SHOTS, 'manifest.json');

if (!existsSync(MANIFEST)) {
    console.error(`No manifest at ${MANIFEST}.\nRun the suite first: node scripts/e2e.mjs`);
    process.exit(2);
}

const shots = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const sections = [];
for (const s of shots) {
    let sec = sections.find((x) => x.name === s.section);
    if (!sec) { sec = { name: s.section, shots: [] }; sections.push(sec); }
    sec.shots.push(s);
}

const INTRO = `# Automated paper trading, step by step

Every screenshot below was captured by the end-to-end suite against a **real paper book**,
during a real run. Nothing here is a mockup, and nothing was staged: where a screen shows
an empty state or a refusal, that is what the app actually did at that moment.

Regenerate with:

\`\`\`bash
# needs a dev server, credentials, and Playwright supplied from somewhere
node scripts/e2e.mjs && node scripts/build-walkthrough.mjs
\`\`\`

> **On \`npm run test:e2e\`** — it still does not work. \`@playwright/test\` has never
> installed on this machine, so the suite runs on a separately-supplied Playwright via
> \`scripts/e2e.mjs\`. See \`docs/AUTOMATION.md\`.

---

`;

let md = INTRO;
for (const sec of sections) {
    md += `## ${sec.name}\n\n`;
    for (const s of sec.shots) {
        md += `### ${s.caption}\n\n![${s.caption.replace(/[[\]]/g, '')}](screenshots/${s.file})\n\n`;
    }
    md += '---\n\n';
}

md += `## What this run did not show

A walkthrough is only evidence of what was exercised. Anything not pictured above was not
reached by the suite, and \`docs/PENDING.md\` is the honest inventory of what is and is not
built.

_${shots.length} screenshots, generated from \`docs/screenshots/manifest.json\`._
`;

writeFileSync(join(ROOT, 'docs', 'AUTOMATED-TRADING.md'), md);
console.log(`docs/AUTOMATED-TRADING.md — ${shots.length} screenshots across ${sections.length} sections`);
