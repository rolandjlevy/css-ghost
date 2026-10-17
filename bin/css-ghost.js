#!/usr/bin/env node

import { resolve } from 'path';
import { existsSync as fsExists } from 'fs';
import { scan } from '../src/scanner.js';
import { generateReport } from '../src/reporter.js';
import { deleteOrphans } from '../src/deleter.js';
import { runSetup } from '../src/setup.js';
import { getAiSummary } from '../src/ai.js';
import { loadConfig, mergeConfig } from '../src/config.js';
import { runInit } from '../src/init.js';

const args = process.argv.slice(2);

// --setup
if (args.includes('--setup')) {
  await runSetup();
  process.exit(0);
}

// --init — interactive wizard that creates css-ghost.config.js
if (args.includes('--init')) {
  await runInit();
  process.exit(0);
}

// --install-hook [dirs...]
if (args.includes('--install-hook')) {
  const { installHook } = await import('../src/hook.js');
  // Any positional args become the directories the hook will scan
  const hookDirs = args.filter(a => !a.startsWith('-'));
  installHook(hookDirs, process.cwd());
  process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
👻 css-ghost — Find orphaned CSS class selectors and custom properties

Usage:
  css-ghost [directory] [directory2] ... [options]

  When no directory is given, an interactive folder picker opens.

Config file:
  css-ghost.config.js   (ESM export, takes priority)
  .css-ghostrc.json     (JSON fallback)

  Example css-ghost.config.js:
    export default {
      dirs:       ['./src'],
      output:     'reports/orphans.md',
      ignore:     ['legacy', 'vendor'],
      strict:     false,
      ghostTrail: false,
    };

Options:
  --output <file>    Output report file path (default: orphan-report.md)
  --delete           Delete all orphaned selectors from source files (prompts first)
  --yes              Skip the deletion confirmation prompt (use with --delete)
  --strict           Exit with code 1 when orphans are found (useful in CI)
  --ghost-trail      Show the last git commit that touched each orphan
  --install-hook     Write a pre-commit hook to .git/hooks/pre-commit
  --ai               Append an AI-generated summary to the report
  --setup            Save your OpenRouter API key for use with --ai
  --init             Create or update css-ghost.config.js interactively
  -h, --help         Show this help message

  CLI flags always override config file values.

Examples:
  css-ghost                          # interactive folder picker
  css-ghost ./src
  css-ghost ./src ./components
  css-ghost ./src --ghost-trail      # show git history for each orphan
  css-ghost ./src --strict           # exit 1 when orphans found (CI mode)
  css-ghost ./src --delete
  css-ghost ./src --delete --yes
  css-ghost --install-hook ./src     # install pre-commit hook for ./src
  css-ghost ./src --ai
  css-ghost ./src --output ./reports/css-audit.md
`);
  process.exit(0);
}

// ── Load config file ─────────────────────────────────────────────────────────
const { config, configPath } = await loadConfig();

// ── Parse CLI flags ──────────────────────────────────────────────────────────
const cliUseAi       = args.includes('--ai');
const cliDoDelete    = args.includes('--delete');
const cliSkipConfirm = args.includes('--yes') || args.includes('-y');
const cliStrict      = args.includes('--strict');
const cliGhostTrail  = args.includes('--ghost-trail');
const outputIdx      = args.indexOf('--output');
const cliOutputPath  = outputIdx !== -1 ? args[outputIdx + 1] : null;

if (outputIdx !== -1 && !cliOutputPath) {
  console.error('❌ --output requires a file path');
  process.exit(1);
}

// Positional args → candidate CLI dirs (strip flags and their values)
const cliRawDirs = args.filter((a, i) =>
  !a.startsWith('-') && (outputIdx === -1 || i !== outputIdx + 1)
);

// ── Merge CLI + config (CLI wins) ────────────────────────────────────────────
const opts = mergeConfig(
  {
    dirs:        cliRawDirs,
    output:      cliOutputPath,
    strict:      cliStrict      || undefined,
    ghostTrail:  cliGhostTrail  || undefined,
    ai:          cliUseAi       || undefined,
    doDelete:    cliDoDelete    || undefined,
    skipConfirm: cliSkipConfirm || undefined,
  },
  config,
);

const { output: outputPath, strict, ghostTrail, ai: useAi, doDelete, skipConfirm, ignore } = opts;

// ── Resolve directories ───────────────────────────────────────────────────────
let dirs;

if (opts.dirs.length === 0) {
  // No dirs from CLI or config → interactive picker
  const { pickDirectories } = await import('../src/picker.js');
  dirs = await pickDirectories();
  console.log('');
} else {
  dirs = [];
  for (const d of opts.dirs) {
    const resolved = resolve(d);
    if (!fsExists(resolved)) {
      console.error(`❌ Directory not found: ${d}`);
      process.exit(1);
    }
    dirs.push(resolved);
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────
if (configPath) {
  const rel = configPath.replace(process.cwd() + '/', '');
  console.log(`\n⚙️  Using config: ${rel}`);
}

console.log(`\n👻 css-ghost scanning ${dirs.length} director${dirs.length === 1 ? 'y' : 'ies'}...`);
dirs.forEach(d => console.log(`   📁 ${d}`));
if (ignore.length) console.log(`   🚫 Ignoring: ${ignore.join(', ')}`);
console.log('');

const results = scan(dirs, { ignore });

if (results.length === 0) {
  console.log('🔍 No style files found in the specified directories.\n');
  process.exit(0);
}

// Ghost trail — fetch git history for each orphan (opt-in, runs before report)
if (ghostTrail) {
  const { isGitRepo, getGhostTrails } = await import('../src/git.js');
  if (!isGitRepo(process.cwd())) {
    console.warn('⚠️  --ghost-trail: not a git repository — skipping git history.\n');
  } else {
    const totalOrphans = results.reduce(
      (n, r) => n + r.orphaned.length + (r.orphanedVars?.length ?? 0), 0
    );
    if (totalOrphans > 0) {
      process.stdout.write(`🔍 Fetching git history for ${totalOrphans} orphan${totalOrphans !== 1 ? 's' : ''}...`);
      for (const result of results) {
        if (result.orphaned.length > 0) {
          result.trails = await getGhostTrails(result.orphaned, process.cwd());
        }
        if ((result.orphanedVars?.length ?? 0) > 0) {
          result.varTrails = await getGhostTrails(result.orphanedVars, process.cwd(), { isVar: true });
        }
      }
      process.stdout.write(' done\n\n');
    }
  }
}

// Get AI summary before writing report (so it can be included in the .md)
const aiSummary = useAi ? await getAiSummary(results) : null;

const { totalAllOrphans } = generateReport(results, outputPath, aiSummary);

if (doDelete) {
  await deleteOrphans(results, { yes: skipConfirm });
}

// --strict: exit 1 if any orphans were found (for CI / pre-commit hooks)
if (strict && totalAllOrphans > 0) {
  process.exit(1);
}
