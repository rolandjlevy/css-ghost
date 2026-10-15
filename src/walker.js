import { readdirSync } from 'fs';
import { join, extname, basename } from 'path';

const STYLE_EXTENSIONS = ['.css', '.scss', '.sass', '.less'];
const COMPONENT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.cache']);

export function walkDir(dir) {
  const styleFiles = [];
  const componentFiles = [];

  function walk(currentDir) {
    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || IGNORE_DIRS.has(entry.name)) continue;

      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        const name = basename(entry.name);
        const ext = extname(entry.name);

        if (STYLE_EXTENSIONS.some(se => name.endsWith(se))) {
          styleFiles.push(fullPath);
        } else if (COMPONENT_EXTENSIONS.has(ext)) {
          componentFiles.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return { styleFiles, componentFiles };
}
