import { readFileSync } from 'fs';
import { extname } from 'path';

// ─── CSS / SCSS selector extraction ────────────────────────────────────────

function extractCssSelectors(content) {
  const selectors = new Set();

  // Strip comments
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  const regex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
  let match;
  while ((match = regex.exec(stripped)) !== null) {
    selectors.add(match[1]);
  }

  return selectors;
}

// ─── JS style file detection & key extraction ───────────────────────────────

export function isJsStyleFile(content, filePath) {
  return (
    /StyleSheet\.create\s*\(\s*\{/.test(content) ||
    (/styles?\.(js|ts)$/.test(filePath) && /(const|let|var)\s+styles?\s*=\s*\{/.test(content))
  );
}

function extractJsStyleKeys(content) {
  const keys = new Set();

  // StyleSheet.create({ key: ... })
  const ssMatch = content.match(/StyleSheet\.create\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  // Plain object: const styles = { key: ... }
  const plainMatch = content.match(/(?:const|let|var)\s+styles?\s*=\s*\{([\s\S]*)\}/);

  const objectContent = ssMatch?.[1] ?? plainMatch?.[1];
  if (objectContent) {
    const keyRegex = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/gm;
    let m;
    while ((m = keyRegex.exec(objectContent)) !== null) {
      keys.add(m[1]);
    }
  }

  return keys;
}

// ─── Component file usage extraction ────────────────────────────────────────

export function extractUsages(content) {
  const used = new Set();
  let hasDynamic = false;

  // className="foo bar" or className='foo'
  const directRegex = /className\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = directRegex.exec(content)) !== null) {
    m[1].trim().split(/\s+/).forEach(c => c && used.add(c));
  }

  // styles.foo
  const dotRegex = /styles?\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  while ((m = dotRegex.exec(content)) !== null) {
    used.add(m[1]);
  }

  // styles['foo'] or styles["foo"]
  const bracketStringRegex = /styles?\[['"]([a-zA-Z_$][a-zA-Z0-9_$]*)['"]]/g;
  while ((m = bracketStringRegex.exec(content)) !== null) {
    used.add(m[1]);
  }

  // styles[variable] — dynamic, flag it
  if (/styles?\[(?!['"])/.test(content)) {
    hasDynamic = true;
  }

  // cx('foo', 'bar') / clsx('foo') / classnames('foo')
  const cxRegex = /(?:cx|clsx|classnames)\s*\(([^)]+)\)/g;
  while ((m = cxRegex.exec(content)) !== null) {
    const inner = m[1];
    const strRegex = /['"]([a-zA-Z_-][a-zA-Z0-9_-]*)["']/g;
    let sm;
    while ((sm = strRegex.exec(inner)) !== null) {
      used.add(sm[1]);
    }
  }

  // Template literal dynamic class names
  if (/`[^`]*\$\{[^}]+\}[^`]*`/.test(content)) {
    hasDynamic = true;
  }

  return { used, hasDynamic };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function parseStyleFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const ext = extname(filePath);

  if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
    return { selectors: extractCssSelectors(content), hasDynamic: false };
  }

  // JS/TS style file
  const selectors = extractJsStyleKeys(content);
  return { selectors, hasDynamic: false };
}

export function parseComponentFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return extractUsages(content);
}
