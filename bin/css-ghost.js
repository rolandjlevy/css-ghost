#!/usr/bin/env node

import { resolve } from 'path';
import { existsSync as fsExists } from 'fs';
import { scan } from '../src/scanner.js';
import { generateReport } from '../src/reporter.js';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
👻 css-ghost — Find orphaned CSS class selectors

Usage:
  css-ghost <directory> [directory2] ... [options]

Options:
  --output <file>   Output report file path (default: orphan-report.md)
  -h, --help        Show this help message

Examples:
  css-ghost ./src
  css-ghost ./src ./components
  css-ghost ./src --output ./reports/css-audit.md
`);
  process.exit(0);
}

// Parse --output flag
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : 'orphan-report.md';

if (outputIdx !== -1 && !outputPath) {
  console.error('❌ --output requires a file path');
  process.exit(1);
}

// Remaining args are directories
const rawDirs = args.filter((a, i) => !a.startsWith('--') && (outputIdx === -1 || i !== outputIdx + 1));

if (rawDirs.length === 0) {
  console.error('❌ At least one directory is required');
  process.exit(1);
}

// Validate directories exist
const dirs = [];
for (const d of rawDirs) {
  const resolved = resolve(d);
  if (!fsExists(resolved)) {
    console.error(`❌ Directory not found: ${d}`);
    process.exit(1);
  }
  dirs.push(resolved);
}

console.log(`\n👻 css-ghost scanning ${dirs.length} director${dirs.length === 1 ? 'y' : 'ies'}...`);
dirs.forEach(d => console.log(`   📁 ${d}`));
console.log('');

const results = scan(dirs);

if (results.length === 0) {
  console.log('🔍 No style files found in the specified directories.\n');
  process.exit(0);
}

generateReport(results, outputPath);
