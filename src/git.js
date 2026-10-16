import { execFileSync, execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// File globs to restrict class-name searches to component files only
const COMPONENT_PATTERNS = [
  '*.tsx', '*.jsx', '*.ts', '*.js',
  '*.html', '*.vue', '*.svelte',
];

export function isGitRepo(cwd) {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function fetchTrail(searchStr, cwd, filePatterns) {
  try {
    const args = [
      'log',
      '-S', searchStr,
      '--pretty=format:%h|%an|%ar|%s',
      '-1',
    ];
    if (filePatterns.length > 0) {
      args.push('--');
      args.push(...filePatterns);
    }
    const { stdout } = await execFileAsync('git', args, { cwd, timeout: 8000 });
    const line = stdout.trim();
    if (!line) return null;

    const firstPipe  = line.indexOf('|');
    const secondPipe = line.indexOf('|', firstPipe + 1);
    const thirdPipe  = line.indexOf('|', secondPipe + 1);

    return {
      hash:    line.slice(0, firstPipe),
      author:  line.slice(firstPipe + 1, secondPipe),
      when:    line.slice(secondPipe + 1, thirdPipe),
      subject: line.slice(thirdPipe + 1),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the most recent git commit that changed the occurrence count of each
 * orphan's identifier in the repository.
 *
 * For class-name orphans, the search is limited to component file extensions
 * so the results reflect usage history rather than the style-file definition.
 *
 * For CSS variable orphans (`isVar: true`), the search term is `var(--name`
 * and is not restricted to file types.
 *
 * Returns an object mapping orphan name → trail (or null when not found).
 */
export async function getGhostTrails(orphans, cwd, { isVar = false } = {}) {
  const searches = orphans.map(o => {
    const searchStr  = isVar ? `var(${o.name}` : o.name;
    const patterns   = isVar ? [] : COMPONENT_PATTERNS;
    return fetchTrail(searchStr, cwd, patterns).then(trail => [o.name, trail]);
  });

  const entries = await Promise.all(searches);
  return Object.fromEntries(entries);
}
