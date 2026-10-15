import { writeFileSync } from 'fs';
import { relative } from 'path';

export function generateReport(results, outputPath = 'orphan-report.md') {
  let totalDefined = 0;
  let totalOrphaned = 0;
  let filesWithOrphans = 0;

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

    const lines = [
      `## \`${relPath}\``,
      '',
      `| Defined | Orphaned | Unused % |`,
      `| --- | --- | --- |`,
      `| ${total} | ${orphaned.length} | ${pct}% |`,
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
      lines.push('**Orphaned selectors:**');
      lines.push('');
      orphaned.forEach(s => lines.push(`- \`.${s}\``));
      lines.push('');
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
    '',
    '---',
    '',
  ].join('\n');

  const content = summary + sections.join('');
  writeFileSync(outputPath, content, 'utf-8');

  console.log(`✅ Report written to ${outputPath}`);
  console.log(`📊 ${totalOrphaned} orphaned selector${totalOrphaned !== 1 ? 's' : ''} across ${filesWithOrphans} file${filesWithOrphans !== 1 ? 's' : ''}`);
  console.log(`📁 ${results.length} style file${results.length !== 1 ? 's' : ''} scanned\n`);
}
