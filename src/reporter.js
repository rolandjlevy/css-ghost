import { writeFileSync } from 'fs';
import { relative } from 'path';
import pc from 'picocolors';

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

/** Format a ghost-trail entry for markdown. */
function trailMd(trail) {
  if (!trail) return '';
  return `> 🕵️  Last git activity: \`${trail.hash}\` by ${trail.author} · ${trail.when} — *"${trail.subject}"*\n`;
}

/** Format a ghost-trail entry for console. */
function trailConsole(trail) {
  if (!trail) return '';
  return `      ${pc.dim(`🕵️  ${trail.hash} · ${trail.author} · ${trail.when}`)} ${pc.dim(`"${trail.subject}"`)}\n`;
}

export function generateReport(results, outputPath = 'orphan-report.md', aiSummary = null) {
  let totalDefined    = 0;
  let totalOrphaned   = 0;
  let totalVarsDefined  = 0;
  let totalVarsOrphaned = 0;
  let filesWithOrphans  = 0;
  let totalRaw = 0;
  let totalMin = 0;

  const sections = [];

  for (const result of results) {
    const { filePath, orphaned, orphanedVars = [], total, totalVars = 0,
            hasDynamic, dynamicFiles, trails, varTrails } = result;

    totalDefined      += total;
    totalOrphaned     += orphaned.length;
    totalVarsDefined  += totalVars;
    totalVarsOrphaned += orphanedVars.length;

    const hasOrphans    = orphaned.length > 0;
    const hasVarOrphans = orphanedVars.length > 0;
    if (hasOrphans || hasVarOrphans) filesWithOrphans++;

    if (!hasOrphans && !hasVarOrphans && !hasDynamic) continue;

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

    if (totalVars > 0) {
      lines.push(`| CSS variables defined | CSS variables orphaned |`);
      lines.push(`| --- | --- |`);
      lines.push(`| ${totalVars} | ${orphanedVars.length} |`);
      lines.push('');
    }

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
        const trail = trails?.[name];
        if (trail) lines.push(trailMd(trail));
        if (rule) {
          lines.push('```css');
          lines.push(rule);
          lines.push('```');
        }
        lines.push('');
      });
    }

    if (hasVarOrphans) {
      lines.push('### 🔮 Orphaned CSS variables\n');
      lines.push('> These custom properties are defined but never referenced via `var()`.\n');

      orphanedVars.forEach(({ name, line, rule }) => {
        lines.push(`#### \`${name}\` — line ${line}`);
        lines.push('');
        const trail = varTrails?.[name];
        if (trail) lines.push(trailMd(trail));
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

  const summaryRows = [
    `| Style files scanned | ${results.length} |`,
    `| Total selectors defined | ${totalDefined} |`,
    `| Total orphaned selectors | ${totalOrphaned} |`,
  ];
  if (totalVarsDefined > 0) {
    summaryRows.push(`| CSS variables defined | ${totalVarsDefined} |`);
    summaryRows.push(`| CSS variables orphaned | ${totalVarsOrphaned} |`);
  }
  summaryRows.push(`| Files with orphans | ${filesWithOrphans} |`);
  summaryRows.push(`| Overall unused rate | ${unusedPct}% |`);
  summaryRows.push(`| Potential savings | ${formatBytes(totalRaw)} raw · ${formatBytes(totalMin)} minified |`);

  const summary = [
    '# 👻 css-ghost — Orphaned Selector Report',
    '',
    `_Generated: ${new Date().toUTCString()}_`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `| --- | --- |`,
    ...summaryRows,
    '',
    '---',
    '',
  ].join('\n');

  const aiBlock = aiSummary
    ? `## 🤖 AI Summary\n\n${aiSummary}\n\n---\n\n`
    : '';

  const mdContent = summary + aiBlock + sections.join('');
  writeFileSync(outputPath, mdContent, 'utf-8');

  // ── Console output ─────────────────────────────────────────────────────────
  const totalAllOrphans = totalOrphaned + totalVarsOrphaned;
  const orphanCount = `${pc.bold(pc.yellow(totalOrphaned))} orphaned selector${totalOrphaned !== 1 ? 's' : ''}`;
  const varOrphanCount = totalVarsOrphaned > 0
    ? ` · ${pc.bold(pc.magenta(totalVarsOrphaned))} orphaned CSS variable${totalVarsOrphaned !== 1 ? 's' : ''}`
    : '';
  const fileCount = `${pc.bold(filesWithOrphans)} file${filesWithOrphans !== 1 ? 's' : ''}`;

  console.log(`📊 ${orphanCount}${varOrphanCount} in ${fileCount}. See: ${pc.cyan(outputPath)}`);
  if (totalMin > 0) console.log(`💾 Potential savings: ${pc.green(formatBytes(totalMin))} minified\n`);
  else console.log('');

  if (aiSummary) {
    console.log(`🤖 ${pc.bold('AI summary')}\n`);
    console.log(`   ${aiSummary.split('\n').join('\n   ')}\n`);
  }

  for (const result of results) {
    const { orphaned, orphanedVars = [], trails, varTrails } = result;
    if (orphaned.length === 0 && orphanedVars.length === 0) continue;

    const relPath = relative(process.cwd(), result.filePath);
    const s = calcSavings(orphaned.map(o => o.rule).filter(Boolean));
    const savingsSuffix = s.raw > 0
      ? pc.dim(` — saves ~${formatBytes(s.raw)} (${formatBytes(s.min)} minified)`)
      : '';
    console.log(`✅ ${pc.bold(relPath)}${savingsSuffix}\n`);

    orphaned.forEach(({ name, line, rule }) => {
      console.log(`   👻 ${pc.yellow('.' + name)} ${pc.dim(`(line ${line})`)}`);
      const trail = trails?.[name];
      if (trail) process.stdout.write(trailConsole(trail));
      if (rule) {
        const preview = rule.split('\n').slice(0, 4).join('\n');
        console.log(preview.split('\n').map(l => `      ${pc.dim(l)}`).join('\n'));
      }
      console.log('');
    });

    if (orphanedVars.length > 0) {
      console.log(`   ${pc.magenta('🔮 Orphaned CSS variables:')}\n`);
      orphanedVars.forEach(({ name, line, rule }) => {
        console.log(`   🔮 ${pc.magenta(name)} ${pc.dim(`(line ${line})`)}`);
        const trail = varTrails?.[name];
        if (trail) process.stdout.write(trailConsole(trail));
        if (rule) {
          console.log(`      ${pc.dim(rule)}`);
        }
        console.log('');
      });
    }
  }

  // Return totals so callers can check orphan counts (e.g. for --strict)
  return { totalOrphaned, totalVarsOrphaned, totalAllOrphans };
}
