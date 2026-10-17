/**
 * css-ghost smoke test — verifies scan() completes without throwing on every
 * fixture directory and that each result has the expected shape.
 *
 * Run with:  node test/run.js   (or:  npm test)
 */

import { scan } from '../src/index.js';
import { resolve, dirname } from 'path';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const fixtures = readdirSync(__dirname, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => resolve(__dirname, d.name));

if (fixtures.length === 0) {
  console.error('❌ No fixture directories found in test/');
  process.exit(1);
}

let passed = 0;
let failed = 0;

for (const fixture of fixtures) {
  const name = fixture.split('/').at(-1);
  try {
    const results = scan([fixture]);

    // Verify each result has the expected shape
    for (const r of results) {
      if (typeof r.filePath !== 'string') throw new Error('filePath missing');
      if (!Array.isArray(r.orphaned)) throw new Error('orphaned must be array');
      if (!Array.isArray(r.orphanedVars)) throw new Error('orphanedVars must be array');
      if (typeof r.total !== 'number') throw new Error('total must be number');
      if (typeof r.hasDynamic !== 'boolean') throw new Error('hasDynamic must be boolean');
    }

    const styleFiles = results.length;
    const orphans = results.reduce((n, r) => n + r.orphaned.length + r.orphanedVars.length, 0);
    console.log(`✅ ${name.padEnd(22)} — ${styleFiles} style file(s), ${orphans} orphan(s)`);
    passed++;
  } catch (err) {
    console.error(`❌ ${name.padEnd(22)} — FAILED: ${err.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
