import { readFileSync } from 'fs';
import { extname } from 'path';
import { walkDir } from './walker.js';
import { parseStyleFile, parseComponentFile, isJsStyleFile } from './parser.js';

export function scan(dirs) {
  const allStyleFiles = [];
  const allJsCandidates = [];

  for (const dir of dirs) {
    const { styleFiles, componentFiles } = walkDir(dir);
    allStyleFiles.push(...styleFiles);
    allJsCandidates.push(...componentFiles);
  }

  // Split JS/TS files into style files vs component files.
  // makeStyles files are dual-role: they define style keys AND may reference
  // those classes in the same file, so they go into both lists.
  const jsStyleFiles = [];
  const componentFiles = [];

  for (const file of allJsCandidates) {
    const ext = extname(file);
    if (['.js', '.ts'].includes(ext)) {
      try {
        const content = readFileSync(file, 'utf-8');
        if (isJsStyleFile(content, file)) {
          jsStyleFiles.push(file);
          // makeStyles files may also consume their own classes in the same file
          if (/makeStyles\s*\(/.test(content)) componentFiles.push(file);
          continue;
        }
      } catch {
        // unreadable — treat as component
      }
    }
    componentFiles.push(file);
  }

  const styleFiles = [...allStyleFiles, ...jsStyleFiles];

  // ── PASS 1: Parse all style files once and cache results ─────────────────
  // This avoids double-reading and gives us cssVars / varUsages in one shot.
  const parsedStyleFiles = new Map(); // filePath → parseStyleFile result

  const globalUsedVars = new Set(); // CSS var usages collected from ALL files

  for (const styleFile of styleFiles) {
    try {
      const parsed = parseStyleFile(styleFile);
      parsedStyleFiles.set(styleFile, parsed);
      // Count var usages defined within style files themselves
      // (e.g. one CSS file using a var defined in another)
      if (parsed.varUsages) {
        for (const v of parsed.varUsages) globalUsedVars.add(v);
      }
    } catch (e) {
      console.warn(`⚠️  Could not parse ${styleFile}: ${e.message}`);
    }
  }

  // ── PASS 2: Parse component files — collect class usages + var usages ─────
  const globalUsed = new Set();
  const dynamicComponentFiles = [];

  for (const file of componentFiles) {
    try {
      const { used, usedVars, hasDynamic } = parseComponentFile(file);
      for (const cls of used) globalUsed.add(cls);
      if (usedVars) for (const v of usedVars) globalUsedVars.add(v);
      if (hasDynamic) dynamicComponentFiles.push(file);
    } catch {
      // skip unreadable files
    }
  }

  // ── PASS 3: Cross-reference and build results ─────────────────────────────
  const results = [];

  for (const styleFile of styleFiles) {
    const parsed = parsedStyleFiles.get(styleFile);
    if (!parsed) continue;

    const { selectors, cssVars, hasDynamic } = parsed;

    // Orphaned class selectors
    const orphaned = [...selectors.entries()]
      .filter(([name]) => !globalUsed.has(name))
      .map(([name, meta]) => ({ name, ...meta }));

    // Orphaned CSS custom properties
    const orphanedVars = cssVars
      ? [...cssVars.entries()]
          .filter(([name]) => !globalUsedVars.has(name))
          .map(([name, meta]) => ({ name, ...meta }))
      : [];

    results.push({
      filePath: styleFile,
      total: selectors.size,
      orphaned,
      orphanedVars,
      totalVars: cssVars?.size ?? 0,
      hasDynamic: hasDynamic || dynamicComponentFiles.length > 0,
      dynamicFiles: dynamicComponentFiles,
    });
  }

  return results;
}
