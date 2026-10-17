import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import pc from 'picocolors';

/**
 * Write a pre-commit hook that runs css-ghost with --strict on every commit.
 * The hook exits 1 (blocking the commit) if any orphaned selectors are found.
 *
 * `dirs` — the directories the hook should scan; defaults to '.' when empty.
 * `cwd`  — repo root to write the hook into.
 */
export function installHook(dirs, cwd = process.cwd()) {
  const gitDir = join(cwd, '.git');
  if (!existsSync(gitDir)) {
    console.error(`${pc.red('❌')} No ${pc.bold('.git')} directory found — is this a git repository?`);
    process.exit(1);
  }

  const hooksDir = join(gitDir, 'hooks');
  mkdirSync(hooksDir, { recursive: true });

  const hookPath   = join(hooksDir, 'pre-commit');
  const dirArgs    = dirs.length > 0 ? dirs.join(' ') : '.';
  const alreadyExists = existsSync(hookPath);

  // Single-quote escaping for shell: end the string, insert \', reopen it.
  const sq = (s) => s.replace(/'/g, "'\\''");

  const script = [
    '#!/bin/sh',
    '# css-ghost pre-commit hook',
    '# Blocks commits when orphaned CSS selectors are present.',
    `# Installed via: css-ghost --install-hook ${dirArgs}`,
    `# Scans:         ${dirArgs}`,
    '# Skip once:     git commit --no-verify',
    '# Uninstall:     rm .git/hooks/pre-commit',
    '',
    `echo "👻  css-ghost — checking for orphaned CSS selectors..."`,
    `npx --yes css-ghost ${dirArgs} --strict --output /tmp/css-ghost-hook-report.md`,
    '',
    'if [ $? -ne 0 ]; then',
    '  echo ""',
    `  echo "❌  Commit blocked: orphaned CSS selectors found in: ${sq(dirArgs)}"`,
    `  echo "    Run 'css-ghost ${sq(dirArgs)}' to see the full report"`,
    `  echo "    Run 'css-ghost ${sq(dirArgs)} --delete' to remove them"`,
    '  echo "    Or skip this check: git commit --no-verify"',
    '  exit 1',
    'fi',
    '',
    'exit 0',
  ].join('\n') + '\n';

  writeFileSync(hookPath, script, { mode: 0o755 });

  if (alreadyExists) {
    console.log(`${pc.yellow('⚠️ ')} Overwrote existing pre-commit hook`);
  } else {
    console.log(`${pc.green('✅')} Pre-commit hook installed at ${pc.bold('.git/hooks/pre-commit')}`);
  }
  console.log(`   Scans:      ${pc.cyan(dirArgs)}`);
  console.log(`   Blocks:     commits when orphaned selectors are found`);
  console.log(`   Skip once:  ${pc.dim('git commit --no-verify')}`);
  console.log(`   Uninstall:  ${pc.dim('rm .git/hooks/pre-commit')}`);
}
