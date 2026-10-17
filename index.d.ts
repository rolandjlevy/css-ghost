/**
 * TypeScript declarations for @rolandjlevy/css-ghost
 * Import from the package root to get `scan` and `generateReport`.
 */

/** A single orphaned class selector or CSS variable. */
export interface OrphanedItem {
  /** The selector name (without leading `.`) or CSS variable name (with `--` prefix). */
  name: string;
  /** Line number in the source style file. */
  line: number;
  /** The raw CSS rule text, if available. */
  rule?: string;
}

/** Git blame info for a single orphaned item (--ghost-trail mode). */
export interface GhostTrail {
  /** Short commit hash. */
  hash: string;
  /** Commit author name. */
  author: string;
  /** Human-readable date/time of the commit. */
  when: string;
  /** Commit subject line. */
  subject: string;
}

/**
 * Per-file result returned by `scan()`.
 * One entry per style file processed.
 */
export interface ScanResult {
  /** Absolute path to the style file. */
  filePath: string;
  /** Total number of class selectors defined in the file. */
  total: number;
  /** Class selectors that are defined but never referenced in component files. */
  orphaned: OrphanedItem[];
  /** CSS custom properties (`--foo`) defined but never used via `var()`. */
  orphanedVars: OrphanedItem[];
  /** Total number of CSS custom properties defined in the file. */
  totalVars: number;
  /**
   * `true` when the co-located component files use dynamic class access
   * (`styles[variable]`, template literals) — results may be incomplete.
   */
  hasDynamic: boolean;
  /** Absolute paths of component files that contain dynamic class references. */
  dynamicFiles: string[];
  /**
   * Ghost-trail git blame data for orphaned selectors, keyed by selector name.
   * Only present when `--ghost-trail` is active or you call the git module directly.
   */
  trails?: Record<string, GhostTrail>;
  /**
   * Ghost-trail git blame data for orphaned CSS variables, keyed by variable name.
   * Only present when `--ghost-trail` is active or you call the git module directly.
   */
  varTrails?: Record<string, GhostTrail>;
}

/** Totals returned by `generateReport()`. Useful for CI / strict-mode checks. */
export interface ReportTotals {
  /** Number of orphaned class selectors across all scanned files. */
  totalOrphaned: number;
  /** Number of orphaned CSS variables across all scanned files. */
  totalVarsOrphaned: number;
  /** Sum of `totalOrphaned` and `totalVarsOrphaned`. */
  totalAllOrphans: number;
}

/**
 * Scan one or more directories for orphaned CSS selectors and CSS custom properties.
 *
 * @param dirs - Absolute paths to the directories you want to scan.
 * @returns An array of per-file results — one entry per style file found.
 *
 * @example
 * import { scan } from '@rolandjlevy/css-ghost';
 * import { resolve } from 'path';
 *
 * const results = scan([resolve(process.cwd(), 'src')]);
 * const totalOrphans = results.reduce((n, r) => n + r.orphaned.length + r.orphanedVars.length, 0);
 * console.log(`Found ${totalOrphans} orphan(s).`);
 */
export function scan(dirs: string[]): ScanResult[];

/**
 * Generate a Markdown report file and print a summary to stdout.
 *
 * @param results   - Output from `scan()`.
 * @param outputPath - Where to write the `.md` report. Defaults to `'orphan-report.md'`.
 * @param aiSummary - Optional AI-generated summary string to embed in the report.
 * @returns Totals you can use for CI gates or `--strict` mode.
 *
 * @example
 * import { scan, generateReport } from '@rolandjlevy/css-ghost';
 * import { resolve } from 'path';
 *
 * const results = scan([resolve(process.cwd(), 'src')]);
 * const { totalAllOrphans } = generateReport(results, 'orphan-report.md');
 * if (totalAllOrphans > 0) process.exit(1);
 */
export function generateReport(
  results: ScanResult[],
  outputPath?: string,
  aiSummary?: string | null
): ReportTotals;
