#!/usr/bin/env node

import { resolve } from 'path';
import { existsSync as fsExists } from 'fs';
import { scan } from '../src/scanner.js';
import { generateReport } from '../src/reporter.js';
import { runSetup } from '../src/setup.js';
import { getAiSummary } from '../src/ai.js';

const args = process.argv.slice(2);

// --setup
if (args.includes('--setup')) {
  await runSetup();
  process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
👻 css-ghost — Find orphaned CSS class selectors

Usage:
  css-ghost [directory] [directory2] ... [options]

  When no directory is given, an interactive folder picker opens.

Options:
  --output <file>   Output report file path (default: orphan-report.md)
  --ai              Append an AI-generated summary to the report
  --setup           Save your OpenRouter API key for use with --ai
  -h, --help        Show this help message

Examples:
  css-ghost                        # interactive folder picker
  css-ghost ./src
  css-ghost ./src ./components
  css-ghost ./src --ai
  css-ghost ./src --output ./reports/css-audit.md
`);
  process.exit(0);
}

// Parse flags
const useAi = args.includes('--ai');
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : 'orphan-report.md';

if (outputIdx !== -1 && !outputPath) {
  console.error('❌ --output requires a file path');
  process.exit(1);
}

// Remaining args are directories (strip flags and their values)
const rawDirs = args.filter((a, i) =>
  !a.startsWith('--') && (outputIdx === -1 || i !== outputIdx + 1)
);

// No directories given → launch interactive picker
let dirs;
if (rawDirs.length === 0) {
  const { pickDirectories } = await import('../src/picker.js');
  dirs = await pickDirectories();
  console.log('');
} else {
  // Validate provided directories exist
  dirs = [];
  for (const d of rawDirs) {
    const resolved = resolve(d);
    if (!fsExists(resolved)) {
      console.error(`❌ Directory not found: ${d}`);
      process.exit(1);
    }
    dirs.push(resolved);
  }
}

console.log(`\n👻 css-ghost scanning ${dirs.length} director${dirs.length === 1 ? 'y' : 'ies'}...`);
dirs.forEach(d => console.log(`   📁 ${d}`));
console.log('');

const results = scan(dirs);

if (results.length === 0) {
  console.log('🔍 No style files found in the specified directories.\n');
  process.exit(0);
}

// Get AI summary before writing report (so it can be included in the .md)
const aiSummary = useAi ? await getAiSummary(results) : null;

generateReport(results, outputPath, aiSummary);
