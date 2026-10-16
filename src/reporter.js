import { writeFileSync } from 'fs';
import { relative } from 'path';

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')   // strip comments
    .replace(/\s+/g, ' ')               // collapse whitespace
    .replace(/\s*([{}:;,])\s*/g, '$1') // remove spaces around punctuation
    .trim();
}

function calcSavings(rules) {
  const raw = rules.reduce((n, r) => n + Buffer.byteLength(r || '', 'utf-8'), 0);
  const min = rules.reduce((n, r) => n + Buffer.byteLength(minifyCss(r || ''), 'utf-8'), 0);
  return { raw, min };
}

function formatBytes(n) {
  if (n === 0) return '0 B';
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} kB`;
}

export function generateReport(results, outputPath = 'orphan-report.md', aiSummary = null) {
  let totalDefined = 0;
  let totalOrphaned = 0;
  let filesWithOrphans = 0;
  let totalRaw = 0;
  let totalMin = 0;

  const sections = [];

  for (const result of results) {
    const { filePath, orphaned, total, hasDynamic, dynamicFiles } = result;
    totalDefined += total;
    totalOrphaned += orphaned.length;

    const hasOrphans = orphaned.length > 0;
    if (hasOrphans) filesWithOrphans++;

    // Skip files with nothing to report
    if (!hasOrphans && !hasDynamic) continue;

    const relPath = relative(process.cwd(), filePath);
    const pct = total > 0 ? Math.round((orphaned.length / total) * 100) : 0;

    const savings = hasOrphans
      ? calcSavings(orphaned.map(o => o.rule).filter(Boolean))
      : { raw: 0, min: 0 };
    totalRaw += savings.raw;
    totalMin += savings.min;

    const savingsStr = hasOrphans
      ? `${formatBytes(savings.raw)} raw · ${formatBytes(savings.min)} minified`
      : '—';

    const lines = [
      `## \`${relPath}\``,
      '',
      `| Defined | Orphaned | Unused % | Potential savings |`,
      `| --- | --- | --- | --- |`,
      `| ${total} | ${orphaned.length} | ${pct}% | ${savingsStr} |`,
      '',
    ];

    if (hasDynamic) {
      lines.push(`> ⚠️ **Dynamic class references detected** — results may be incomplete.`);
      if (dynamicFiles?.length > 0) {
        const relDynamic = dynamicFiles
          .map(f => `\`${relative(process.cwd(), f)}\``)
          .join(', ');
        lines.push(`> Dynamic references found in: ${relDynamic}`);
      }
      lines.push('');
    }

    if (hasOrphans) {
      lines.push('### 👻 Orphaned selectors\n');

      orphaned.forEach(({ name, line, rule }) => {
        lines.push(`#### \`.${name}\` — line ${line}`);
        lines.push('');
        if (rule) {
          lines.push('```css');
          lines.push(rule);
          lines.push('```');
        }
        lines.push('');
      });
    }

    lines.push('---');
    lines.push('');
    sections.push(lines.join('\n'));
  }

  const unusedPct = totalDefined > 0
    ? Math.round((totalOrphaned / totalDefined) * 100)
    : 0;

  const summary = [
    '# 👻 css-ghost — Orphaned Selector Report',
    '',
    `_Generated: ${new Date().toUTCString()}_`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Style files scanned | ${results.length} |`,
    `| Total selectors defined | ${totalDefined} |`,
    `| Total orphaned selectors | ${totalOrphaned} |`,
    `| Files with orphans | ${filesWithOrphans} |`,
    `| Overall unused rate | ${unusedPct}% |`,
    `| Potential savings | ${formatBytes(totalRaw)} raw · ${formatBytes(totalMin)} minified |`,
    '',
    '---',
    '',
  ].join('\n');

  const aiBlock = aiSummary
    ? `## 🤖 AI Summary\n\n${aiSummary}\n\n---\n\n`
    : '';

  const content = summary + aiBlock + sections.join('');
  writeFileSync(outputPath, content, 'utf-8');

  // Console output — also print orphans inline
  console.log(`📊 ${totalOrphaned} orphaned selector${totalOrphaned !== 1 ? 's' : ''} in ${filesWithOrphans} file${filesWithOrphans !== 1 ? 's' : ''}. See: ${outputPath}`);
  if (totalMin > 0) console.log(`💾 Potential savings: ${formatBytes(totalMin)} minified\n`);
  else console.log('');

  if (aiSummary) {
    console.log(`🤖 AI summary\n`);
    console.log(`   ${aiSummary.split('\n').join('\n   ')}\n`);
  }

  for (const result of results) {
    if (result.orphaned.length === 0) continue;
    const relPath = relative(process.cwd(), result.filePath);
    const s = calcSavings(result.orphaned.map(o => o.rule).filter(Boolean));
    const savingsSuffix = s.raw > 0 ? ` — saves ~${formatBytes(s.raw)} (${formatBytes(s.min)} minified)` : '';
    console.log(`✅ ${relPath}${savingsSuffix}\n`);
    result.orphaned.forEach(({ name, line, rule }) => {
      console.log(`   👻 .${name} (line ${line})`);
      if (rule) {
        const preview = rule.split('\n').slice(0, 4).join('\n');
        console.log(preview.split('\n').map(l => `      ${l}`).join('\n'));
      }
      console.log('');
    });
  }
}
