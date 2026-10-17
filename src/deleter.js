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

// Return the start index of a comment block (/* ... */) that sits immediately
// before `idx` in `content` (separated only by whitespace/newlines), or -1.
function findPrecedingComment(content, idx) {
  // Walk backwards over whitespace
  let i = idx - 1;
  while (i >= 0 && /[\s]/.test(content[i])) i--;

  if (i < 1 || content[i] !== '/' || content[i - 1] !== '*') return -1;

  // Found the end of a block comment — now find its start
  const closePos = i - 1; // position of '*/'  second char
  const openPos = content.lastIndexOf('/*', closePos);
  return openPos === -1 ? -1 : openPos;
}

// Delete individual CSS declarations (e.g. `  --token: value;\n`) from content.
function deleteCssDeclarations(content, varNames) {
  let removed = 0;
  for (const name of varNames) {
    // Match `  --name: anything up to semicolon;\n?` including leading whitespace
    const re = new RegExp(`[ \\t]*${escapeRegex(name)}\\s*:[^;]*;[ \\t]*\\n?`, 'g');
    const next = content.replace(re, () => { removed++; return ''; });
    if (next !== content) content = next;
  }
  return { content, removed };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function deleteFromCssFile(filePath, orphans, orphanedVarNames = []) {
  let content = readFileSync(filePath, 'utf-8');
  let removed = 0;

  // ── 1. Delete orphaned class/selector rules ────────────────────────────────
  // Sort longest rules first so that nested/contained rules don't mis-match.
  const sorted = [...orphans].sort((a, b) => (b.rule?.length ?? 0) - (a.rule?.length ?? 0));

  for (const { name, rule } of sorted) {
    if (!rule) continue;
    const idx = content.indexOf(rule);
    if (idx === -1) continue;

    // Bug fix: also remove a comment block immediately preceding the rule.
    const commentStart = findPrecedingComment(content, idx);
    const deleteFrom   = commentStart !== -1 ? commentStart : idx;

    const before = content.slice(0, deleteFrom);
    const after  = content.slice(idx + rule.length);
    // Eat one trailing newline so we don't leave double-blank-lines everywhere.
    content = before + after.replace(/^\n/, '');
    removed++;
  }

  // ── 2. Delete orphaned CSS variable declarations ───────────────────────────
  if (orphanedVarNames.length > 0) {
    const { content: next, removed: varRemoved } = deleteCssDeclarations(content, orphanedVarNames);
    content = next;
    removed += varRemoved;
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
  // A file is eligible for deletion if it has orphaned selectors OR orphaned vars.
  const toDelete = results.filter(r => r.orphaned.length > 0 || (r.orphanedVars?.length ?? 0) > 0);

  if (toDelete.length === 0) {
    console.log('Nothing to delete.\n');
    return 0;
  }

  console.log(
    `\n${pc.bold('🗑️  The following orphaned selectors and CSS variables will be permanently deleted:')}\n`
  );

  for (const { filePath, orphaned, orphanedVars } of toDelete) {
    const rel = relative(process.cwd(), filePath);
    console.log(`  ${pc.bold(rel)}`);
    orphaned.forEach(o =>
      console.log(`    ${pc.yellow('•')} .${o.name} ${pc.dim(`(line ${o.line})`)}`)
    );
    (orphanedVars ?? []).forEach(o =>
      console.log(`    ${pc.magenta('•')} ${o.name} ${pc.dim(`(line ${o.line})`)}`)
    );
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

  for (const { filePath, orphaned, orphanedVars } of toDelete) {
    const ext         = extname(filePath);
    const rel         = relative(process.cwd(), filePath);
    const varNames    = (orphanedVars ?? []).map(v => v.name);
    const totalExpected = orphaned.length + varNames.length;
    let removed;

    try {
      if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
        removed = deleteFromCssFile(filePath, orphaned, varNames);
      } else if (/\.css\.(ts|js)x?$/.test(filePath)) {
        removed = deleteFromVeFile(filePath, orphaned);
      } else {
        removed = deleteFromJsFile(filePath, orphaned);
      }

      const label = removed === totalExpected
        ? pc.green(`✂️  ${rel}`)
        : pc.yellow(`✂️  ${rel}`);
      const note  = removed < totalExpected
        ? pc.dim(` (${totalExpected - removed} could not be located — check manually)`)
        : '';
      console.log(`${label} — removed ${removed}${note}`);
      totalRemoved += removed;
    } catch (err) {
      console.log(`${pc.red('❌')} ${rel} — ${err.message}`);
    }
  }

  const noun = totalRemoved === 1 ? 'item' : 'items';
  console.log(
    `\n${pc.green(pc.bold(`✅ Done.`))} Removed ${totalRemoved} orphaned ${noun}.\n`
  );

  return totalRemoved;
}
