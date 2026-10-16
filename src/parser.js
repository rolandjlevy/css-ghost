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
    /makeStyles\s*\(/.test(content) ||
    (/styles?\.(js|ts)$/.test(filePath) && /(const|let|var)\s+styles?\s*=\s*\{/.test(content))
  );
}

// Extract top-level keys from a JS style object, depth-aware so CSS property
// keys nested inside each class's value object are not returned.
function extractTopLevelKeys(objectContent, startLine) {
  const keys = new Map();
  const objLines = objectContent.split('\n');
  let depth = 0;

  for (let i = 0; i < objLines.length; i++) {
    const line = objLines[i];
    const lineNum = startLine + i;

    if (depth === 0) {
      const keyMatch = line.match(/^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/);
      if (keyMatch) {
        const name = keyMatch[1];
        if (!keys.has(name)) {
          keys.set(name, { line: lineNum, rule: line.trim() });
        }
      }
    }

    for (const char of line) {
      if (char === '{') depth++;
      else if (char === '}') depth--;
    }
  }

  return keys;
}

// Find the content between the first matching { } pair after `startIdx`.
function extractBraceContent(content, startIdx) {
  let braceStart = -1;
  for (let i = startIdx; i < content.length; i++) {
    if (content[i] === '{') { braceStart = i; break; }
  }
  if (braceStart === -1) return null;

  let depth = 0;
  let end = braceStart;
  for (let i = braceStart; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  const inner = content.slice(braceStart + 1, end);
  const startLine = content.slice(0, braceStart + 1).split('\n').length;
  return { inner, startLine };
}

function extractJsStyleKeys(content) {
  const keys = new Map();

  // StyleSheet.create({ ... }) — React Native
  const ssMatch = content.match(/StyleSheet\.create\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  // const styles = { ... } — plain named object
  const plainMatch = content.match(/(?:const|let|var)\s+styles?\s*=\s*\{([\s\S]*)\}/);
  const flatContent = ssMatch?.[1] ?? plainMatch?.[1];

  if (flatContent) {
    const startOffset = content.indexOf(flatContent);
    const startLine = content.slice(0, startOffset).split('\n').length;
    for (const [k, v] of extractTopLevelKeys(flatContent, startLine)) {
      if (!keys.has(k)) keys.set(k, v);
    }
  }

  // makeStyles({ ... }) or makeStyles(theme => ({ ... })) — MUI
  // Handles plain object, arrow returning object, and createStyles wrapper.
  const msRegex = /makeStyles\s*\(/g;
  let msMatch;
  while ((msMatch = msRegex.exec(content)) !== null) {
    const result = extractBraceContent(content, msMatch.index);
    if (!result) continue;
    for (const [k, v] of extractTopLevelKeys(result.inner, result.startLine)) {
      if (!keys.has(k)) keys.set(k, v);
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

  // styles.foo or classes.foo (MUI makeStyles convention)
  const dotRegex = /(?:styles?|classes)\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  while ((m = dotRegex.exec(content)) !== null) {
    used.add(m[1]);
  }

  // styles['foo'] or styles["foo"]
  const bracketStringRegex = /styles?\[['"]([a-zA-Z_$][a-zA-Z0-9_$]*)['"]]/g;
  while ((m = bracketStringRegex.exec(content)) !== null) {
    used.add(m[1]);
  }

  // styles[condition ? 'foo' : 'bar'] — ternary with string literals: extract both branches
  const ternaryBracketRegex = /styles?\[\s*[^?]+\?\s*['"]([a-zA-Z_$][a-zA-Z0-9_$]*)["']\s*:\s*['"]([a-zA-Z_$][a-zA-Z0-9_$]*)["']\s*\]/g;
  while ((m = ternaryBracketRegex.exec(content)) !== null) {
    used.add(m[1]);
    used.add(m[2]);
  }

  // styles[variable] — truly dynamic (not a string literal or ternary): flag it
  const trulyDynamicBracket = /styles?\[(?!['"])(?![^?]+\?\s*['"])/;
  if (trulyDynamicBracket.test(content)) {
    hasDynamic = true;
  }

  // cx('foo', 'bar') / clsx('foo') / classnames('foo')
  // Also handles object syntax: cx({ active: isOn, disabled: true })
  // and array syntax: cx(['foo', condition && 'bar'])
  const cxRegex = /(?:cx|clsx|classnames)\s*\(([\s\S]*?)\)/g;
  while ((m = cxRegex.exec(content)) !== null) {
    const inner = m[1];

    // String literals: 'foo' or "foo"
    const strRegex = /['"]([a-zA-Z_-][a-zA-Z0-9_-]*)["']/g;
    let sm;
    while ((sm = strRegex.exec(inner)) !== null) {
      used.add(sm[1]);
    }

    // Object keys: { active: ..., disabled: ... }
    const objKeyRegex = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/gm;
    while ((sm = objKeyRegex.exec(inner)) !== null) {
      used.add(sm[1]);
    }
  }

  // Template literal dynamic class names — flag only if truly dynamic (has ${})
  // But first extract any static styles.foo refs inside them (already caught above by dotRegex)
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
