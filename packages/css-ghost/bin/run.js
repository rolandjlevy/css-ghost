#!/usr/bin/env node
/**
 * CLI entry point for the `css-ghost` unscoped package.
 * Resolves and runs the CLI from the underlying @rolandjlevy/css-ghost package.
 */
import { createRequire } from 'module';
import { resolve, dirname } from 'path';

const require = createRequire(import.meta.url);

// Resolve the underlying package directory via its package.json
// (package.json is always importable regardless of the exports field)
const pkgDir = dirname(require.resolve('@rolandjlevy/css-ghost/package.json'));

await import(resolve(pkgDir, 'bin/css-ghost.js'));
