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

  // Split JS/TS files into style files vs component files
  const jsStyleFiles = [];
  const componentFiles = [];

  for (const file of allJsCandidates) {
    const ext = extname(file);
    if (['.js', '.ts'].includes(ext)) {
      try {
        const content = readFileSync(file, 'utf-8');
        if (isJsStyleFile(content, file)) {
          jsStyleFiles.push(file);
          continue;
        }
      } catch {
        // unreadable — treat as component
      }
    }
    componentFiles.push(file);
  }

  const styleFiles = [...allStyleFiles, ...jsStyleFiles];

  // Build global usage map from all component files
  const globalUsed = new Set();
  const dynamicComponentFiles = [];

  for (const file of componentFiles) {
    try {
      const { used, hasDynamic } = parseComponentFile(file);
      for (const cls of used) globalUsed.add(cls);
      if (hasDynamic) dynamicComponentFiles.push(file);
    } catch {
      // skip unreadable files
    }
  }

  // Analyse each style file
  const results = [];

  for (const styleFile of styleFiles) {
    try {
      const { selectors, hasDynamic } = parseStyleFile(styleFile);
      // selectors is now a Map: name → { line, rule }
      const orphaned = [...selectors.entries()]
        .filter(([name]) => !globalUsed.has(name))
        .map(([name, meta]) => ({ name, ...meta }));

      results.push({
        filePath: styleFile,
        total: selectors.size,
        orphaned,
        hasDynamic: hasDynamic || dynamicComponentFiles.length > 0,
        dynamicFiles: dynamicComponentFiles,
      });
    } catch (e) {
      console.warn(`⚠️  Could not parse ${styleFile}: ${e.message}`);
    }
  }

  return results;
}
