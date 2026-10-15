import { readFileSync } from 'fs';
import { extname } from 'path';

// ─── CSS / SCSS selector extraction ────────────────────────────────────────

function extractCssSelectors(content) {
  const selectors = new Map(); // name → { line, rule }
  const lines = content.split('\n');

  // Strip block comments but preserve line numbers by replacing with spaces
  const stripped = content.replace(/\/\*[\s\S]*?\*\//g, m =>
    m.replace(/[^\n]/g, ' ')
  );

  // Walk line by line to track line numbers
  const strippedLines = stripped.split('\n');
  let insideRule = false;
  let currentRule = [];
  let currentSelectors = [];
  let ruleStartLine = 0;

  for (let i = 0; i < strippedLines.length; i++) {
    const line = strippedLines[i];
    const lineNum = i + 1;

    if (!insideRule) {
      // Look for .className optionally followed by { on same or next line
      const selectorRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
      let m;
      while ((m = selectorRegex.exec(line)) !== null) {
        currentSelectors.push({ name: m[1], line: lineNum });
      }

      if (line.includes('{')) {
        insideRule = true;
        ruleStartLine = lineNum;
        currentRule = [lines[i]];

        if (line.includes('}')) {
          // Single-line rule
          const ruleText = currentRule.join('\n').trim();
          currentSelectors.forEach(({ name, line: l }) => {
            if (!selectors.has(name)) {
              selectors.set(name, { line: l, rule: ruleText });
            }
          });
          currentSelectors = [];
          currentRule = [];
          insideRule = false;
        }
      } else if (currentSelectors.length > 0 && line.trim() === '') {
        // Empty line with no { means these weren't selectors for a rule
        currentSelectors = [];
      }
    } else {
      currentRule.push(lines[i]);
      if (line.includes('}')) {
        const ruleText = currentRule.join('\n').trim();
        currentSelectors.forEach(({ name, line: l }) => {
          if (!selectors.has(name)) {
            selectors.set(name, { line: l, rule: ruleText });
          }
        });
        currentSelectors = [];
        currentRule = [];
        insideRule = false;
      }
    }
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
  const keys = new Map(); // name → { line, rule }
  const lines = content.split('\n');

  const ssMatch = content.match(/StyleSheet\.create\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  const plainMatch = content.match(/(?:const|let|var)\s+styles?\s*=\s*\{([\s\S]*)\}/);
  const objectContent = ssMatch?.[1] ?? plainMatch?.[1];

  if (objectContent) {
    // Find start offset in original content
    const startOffset = content.indexOf(objectContent);
    const preContent = content.slice(0, startOffset);
    const startLine = preContent.split('\n').length;

    const keyRegex = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/gm;
    let m;
    while ((m = keyRegex.exec(objectContent)) !== null) {
      const keyLine = startLine + objectContent.slice(0, m.index).split('\n').length - 1;
      const name = m[1];
      if (!keys.has(name)) {
        // Grab the value snippet for context
        const lineText = lines[keyLine - 1]?.trim() ?? '';
        keys.set(name, { line: keyLine, rule: lineText });
      }
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
