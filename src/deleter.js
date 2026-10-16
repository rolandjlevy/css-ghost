import { readFileSync, writeFileSync } from 'fs';
import { extname, relative } from 'path';
import { createInterface } from 'readline';
import pc from 'picocolors';

// ─── Helpers ────────────────────────────────────────────────────────────────

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

// Collapse runs of 3+ blank lines down to 2, and ensure a trailing newline.
function normalise(content) {
  return content.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

// Return the 0-based index of the last line belonging to the block that
// starts at `startIdx`. Counts {/(/[ as openers and }/)/] as closers.
function findBlockEnd(lines, startIdx) {
  let depth = 0;
  let hasOpener = false;

  for (let i = startIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{' || ch === '(' || ch === '[') { depth++; hasOpener = true; }
      else if (ch === '}' || ch === ')' || ch === ']') depth--;
    }
    if (hasOpener && depth <= 0) return i;
  }

  return startIdx; // single-line with no opener
}

// ─── CSS / SCSS / LESS ───────────────────────────────────────────────────────

function deleteFromCssFile(filePath, orphans) {
  let content = readFileSync(filePath, 'utf-8');
  let removed = 0;

  // Sort longest rules first so that nested/contained rules don't mis-match.
  const sorted = [...orphans].sort((a, b) => (b.rule?.length ?? 0) - (a.rule?.length ?? 0));

  for (const { name, rule } of sorted) {
    if (!rule) continue;
    const idx = content.indexOf(rule);
    if (idx === -1) continue;

    const before = content.slice(0, idx);
    const after  = content.slice(idx + rule.length);
    // Eat one trailing newline so we don't leave double-blank-lines everywhere.
    content = before + after.replace(/^\n/, '');
    removed++;
  }

  writeFileSync(filePath, normalise(content), 'utf-8');
  return removed;
}

// ─── JS style objects (StyleSheet.create / makeStyles / plain objects) ───────

function deleteFromJsFile(filePath, orphans) {
  const lines = readFileSync(filePath, 'utf-8').split('\n');
  let removed = 0;

  // Reverse order so later splices don't shift earlier line indices.
  const sorted = [...orphans].sort((a, b) => b.line - a.line);

  for (const { name, line } of sorted) {
    const lineIdx = line - 1; // convert to 0-based
    const lineContent = lines[lineIdx] ?? '';

    // Guard: confirm the key is really on this line.
    if (!new RegExp(`\\b${name}\\s*:`).test(lineContent)) continue;

    const endIdx = findBlockEnd(lines, lineIdx);
    lines.splice(lineIdx, endIdx - lineIdx + 1);
    removed++;
  }

  writeFileSync(filePath, normalise(lines.join('\n')), 'utf-8');
  return removed;
}

// ─── vanilla-extract (.css.ts / .css.js) ─────────────────────────────────────

function deleteFromVeFile(filePath, orphans) {
  const lines = readFileSync(filePath, 'utf-8').split('\n');
  let removed = 0;

  const sorted = [...orphans].sort((a, b) => b.line - a.line);

  for (const { name, line } of sorted) {
    const lineIdx = line - 1;
    const lineContent = lines[lineIdx] ?? '';

    if (!lineContent.includes(`export const ${name}`)) continue;

    const endIdx = findBlockEnd(lines, lineIdx);
    lines.splice(lineIdx, endIdx - lineIdx + 1);
    removed++;
  }

  writeFileSync(filePath, normalise(lines.join('\n')), 'utf-8');
  return removed;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function deleteOrphans(results, { yes = false } = {}) {
  const toDelete = results.filter(r => r.orphaned.length > 0);

  if (toDelete.length === 0) {
    console.log('Nothing to delete.\n');
    return 0;
  }

  const totalCount = toDelete.reduce((n, r) => n + r.orphaned.length, 0);

  console.log(
    `\n${pc.bold('🗑️  The following orphaned selectors will be permanently deleted:')}\n`
  );

  for (const { filePath, orphaned } of toDelete) {
    const rel = relative(process.cwd(), filePath);
    console.log(`  ${pc.bold(rel)}`);
    orphaned.forEach(o => console.log(`    ${pc.yellow('•')} .${o.name} ${pc.dim(`(line ${o.line})`)}`));
  }

  if (!yes) {
    const answer = await prompt(
      `\n${pc.yellow('⚠️  This will modify your source files and cannot be undone.')} Continue? ${pc.dim('[y/N]')} `
    );
    if (answer.toLowerCase() !== 'y') {
      console.log('\nCancelled — no files were changed.\n');
      return 0;
    }
  }

  console.log('');
  let totalRemoved = 0;

  for (const { filePath, orphaned } of toDelete) {
    const ext    = extname(filePath);
    const rel    = relative(process.cwd(), filePath);
    let removed;

    try {
      if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
        removed = deleteFromCssFile(filePath, orphaned);
      } else if (/\.css\.(ts|js)x?$/.test(filePath)) {
        removed = deleteFromVeFile(filePath, orphaned);
      } else {
        removed = deleteFromJsFile(filePath, orphaned);
      }

      const label = removed === orphaned.length
        ? pc.green(`✂️  ${rel}`)
        : pc.yellow(`✂️  ${rel}`);
      const note  = removed < orphaned.length
        ? pc.dim(` (${orphaned.length - removed} could not be located — check manually)`)
        : '';
      console.log(`${label} — removed ${removed}${note}`);
      totalRemoved += removed;
    } catch (err) {
      console.log(`${pc.red('❌')} ${rel} — ${err.message}`);
    }
  }

  console.log(
    `\n${pc.green(pc.bold(`✅ Done.`))} Removed ${totalRemoved} orphaned selector${totalRemoved !== 1 ? 's' : ''}.\n`
  );

  return totalRemoved;
}
