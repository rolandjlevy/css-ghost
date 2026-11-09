import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findOrphans, summarise, ghostTrail, resolveInside, ToolError } from '../src/tools.js';

const fixtures = resolve(fileURLToPath(new URL('../../test', import.meta.url)));

test('find_orphans lists selectors and variables with file and line', () => {
  const out = findOrphans({ root: fixtures, path: 'scss' });
  assert.deepEqual(out.totalOrphans, { selectors: 3, variables: 2 });
  const names = out.items.map((i) => i.name).sort();
  assert.deepEqual(names, ['--scss-primary', '--scss-unused-token', 'deprecatedSidebar', 'legacyNav', 'oldHero']);
  for (const item of out.items) {
    assert.equal(item.file, 'scss/layout.scss');
    assert.equal(typeof item.line, 'number');
    assert.equal(item.uncertain, false);
  }
  assert.equal(out.note, undefined);
});

test('find_orphans flags orphans in files with dynamic class access as uncertain', () => {
  const out = findOrphans({ root: fixtures, path: 'dynamic' });
  assert.ok(out.items.length > 0);
  assert.ok(out.items.every((i) => i.uncertain === true));
  assert.deepEqual(out.uncertainFiles, ['dynamic/alert.module.css']);
  assert.match(out.note, /may still be in use/);
});

test('find_orphans caps output and reports how many were left out', () => {
  const out = findOrphans({ root: fixtures, path: 'scss', limit: 2 });
  assert.equal(out.items.length, 2);
  assert.equal(out.truncated, 3);
});

test('find_orphans honours the ignore list', () => {
  const out = findOrphans({ root: fixtures, path: '.', ignore: ['scss'] });
  assert.ok(out.items.every((i) => !i.file.startsWith('scss/')));
});

test('summarise ranks files by orphan count and stays small', () => {
  const out = summarise({ root: fixtures, path: '.' });
  assert.ok(out.filesWithOrphans > 1);
  const counts = out.topFiles.map((f) => f.selectors + f.variables);
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
  assert.ok(out.topFiles.length <= 10);
  assert.ok(out.topFiles.some((f) => f.file === 'scss/layout.scss'));
});

test('paths outside the project root are refused', () => {
  assert.throws(() => resolveInside(join(fixtures, 'scss'), '..'), /outside the project directory/);
  assert.throws(() => resolveInside(fixtures, tmpdir()), /outside the project directory/);
});

test('a symlink that points outside the root is refused', () => {
  const root = mkdtempSync(join(tmpdir(), 'cg-root-'));
  const outside = mkdtempSync(join(tmpdir(), 'cg-out-'));
  symlinkSync(outside, join(root, 'escape'));
  assert.throws(() => resolveInside(root, 'escape'), /outside the project directory/);
});

test('missing paths and files give clear errors', () => {
  assert.throws(() => resolveInside(fixtures, 'nope'), /Path not found/);
  assert.throws(() => resolveInside(fixtures, 'run.js'), /Not a directory/);
  assert.ok(new ToolError('x') instanceof Error);
});

test('ghost_trail finds the last commit for a class and a custom property', async () => {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'cg-git-')));
  const git = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'Tester');
  mkdirSync(join(repo, 'src'));
  writeFileSync(join(repo, 'src', 'Card.jsx'), 'export const C = () => <div className="card-title" style={{ color: "var(--brand-blue)" }} />;\n');
  git('add', '.');
  git('commit', '-q', '-m', 'add card');
  writeFileSync(join(repo, 'src', 'Card.jsx'), 'export const C = () => <div />;\n');
  git('commit', '-qam', 'remove card styling');

  const out = await ghostTrail({ root: repo, names: ['.card-title', '--brand-blue', 'never-existed'] });
  const byName = Object.fromEntries(out.trails.map((t) => [t.name, t.lastChange]));
  assert.equal(byName['card-title'].subject, 'remove card styling');
  assert.equal(byName['--brand-blue'].subject, 'remove card styling');
  assert.equal(byName['never-existed'], null);
});

test('ghost_trail explains when there is no git repository or no names', async () => {
  const plain = mkdtempSync(join(tmpdir(), 'cg-nogit-'));
  await assert.rejects(ghostTrail({ root: plain, names: ['x'] }), /not a git repository/);
  await assert.rejects(ghostTrail({ root: fixtures, names: [] }), /at least one/);
  await assert.rejects(ghostTrail({ root: fixtures, names: Array(26).fill('a') }), /Too many names/);
});
