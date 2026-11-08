import { existsSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { scan, isGitRepo, getGhostTrails } from 'css-ghost';

/*
 * The logic behind the three MCP tools. Kept free of any MCP imports so it can be
 * tested directly. Every function is read-only and returns plain data; failures
 * throw ToolError with a message written for the model to act on.
 */

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;
export const MAX_TRAIL_NAMES = 25;

export class ToolError extends Error {}

/* Resolve `input` (absolute, or relative to `root`) and refuse anything outside
   `root`, including via symlinks. */
export function resolveInside(root, input = '.') {
  const realRoot = realpathSync(root);
  const candidate = isAbsolute(input) ? input : resolve(realRoot, input);
  if (!existsSync(candidate)) {
    throw new ToolError(`Path not found: ${input}. Use a path inside ${realRoot}.`);
  }
  if (!statSync(candidate).isDirectory()) {
    throw new ToolError(`Not a directory: ${input}. Pass the directory that holds the CSS and components.`);
  }
  const real = realpathSync(candidate);
  const rel = relative(realRoot, real);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new ToolError(`Path is outside the project directory (${realRoot}), so it was not scanned.`);
  }
  return real;
}

function clampLimit(limit) {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

function runScan(root, path, ignore = []) {
  const dir = resolveInside(root, path);
  return { dir, results: scan([dir], { ignore }) };
}

/* Orphans in a file that has dynamic class access may be false positives: the
   scanner can't see classes built at runtime. Flag them so the caller doesn't
   delete them blindly. */
export function findOrphans({ root, path, ignore, limit }) {
  const { dir, results } = runScan(root, path, ignore);
  const max = clampLimit(limit);
  const rel = (file) => relative(root, file) || file;

  const items = [];
  const uncertainFiles = [];
  let selectors = 0;
  let variables = 0;

  for (const r of results) {
    const uncertain = r.hasDynamic && (r.orphaned.length > 0 || r.orphanedVars.length > 0);
    if (uncertain) uncertainFiles.push(rel(r.filePath));
    for (const o of r.orphaned) {
      selectors++;
      items.push({ file: rel(r.filePath), kind: 'selector', name: o.name, line: o.line, uncertain: r.hasDynamic });
    }
    for (const o of r.orphanedVars) {
      variables++;
      items.push({ file: rel(r.filePath), kind: 'variable', name: o.name, line: o.line, uncertain: r.hasDynamic });
    }
  }

  const shown = items.slice(0, max);
  return {
    scanned: rel(dir) || '.',
    styleFilesScanned: results.length,
    totalOrphans: { selectors, variables },
    items: shown,
    truncated: items.length - shown.length,
    uncertainFiles,
    note: uncertainFiles.length
      ? 'Items with uncertain: true are in files where class names are built at runtime (dynamic access), so they may still be in use. Check them before deleting.'
      : undefined
  };
}

export function summarise({ root, path, ignore }) {
  const { dir, results } = runScan(root, path, ignore);
  const rel = (file) => relative(root, file) || file;
  const files = results
    .map((r) => ({
      file: rel(r.filePath),
      selectors: r.orphaned.length,
      variables: r.orphanedVars.length,
      definedSelectors: r.total,
      definedVariables: r.totalVars,
      uncertain: r.hasDynamic
    }))
    .filter((f) => f.selectors + f.variables > 0)
    .sort((a, b) => b.selectors + b.variables - (a.selectors + a.variables));

  const sum = (key) => files.reduce((n, f) => n + f[key], 0);
  return {
    scanned: rel(dir) || '.',
    styleFilesScanned: results.length,
    filesWithOrphans: files.length,
    totalOrphans: { selectors: sum('selectors'), variables: sum('variables') },
    topFiles: files.slice(0, 10),
    uncertainFiles: files.filter((f) => f.uncertain).length
  };
}

/* names: class names (with or without a leading dot) or custom properties (--name). */
export async function ghostTrail({ root, names }) {
  if (!Array.isArray(names) || names.length === 0) {
    throw new ToolError('Give at least one selector or custom property name.');
  }
  if (names.length > MAX_TRAIL_NAMES) {
    throw new ToolError(`Too many names (${names.length}). Ask for at most ${MAX_TRAIL_NAMES} at a time.`);
  }
  const realRoot = realpathSync(root);
  if (!isGitRepo(realRoot)) {
    throw new ToolError(`${realRoot} is not a git repository, so there is no history to search.`);
  }

  const clean = [...new Set(names.map((n) => n.trim().replace(/^\./, '')).filter(Boolean))];
  const vars = clean.filter((n) => n.startsWith('--')).map((name) => ({ name }));
  const classes = clean.filter((n) => !n.startsWith('--')).map((name) => ({ name }));

  const [classTrails, varTrails] = await Promise.all([
    classes.length ? getGhostTrails(classes, realRoot) : {},
    vars.length ? getGhostTrails(vars, realRoot, { isVar: true }) : {}
  ]);
  const all = { ...classTrails, ...varTrails };

  return {
    trails: clean.map((name) => ({
      name,
      lastChange: all[name] ?? null
    })),
    note: 'lastChange is the most recent commit that added or removed this name in component files (class names) or in var() calls (custom properties). null means no commit was found.'
  };
}
