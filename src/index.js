/**
 * css-ghost — Programmatic API
 *
 * Use this when integrating css-ghost into build tools, scripts, or plugins
 * rather than running it as a CLI.
 *
 * @example
 * import { scan, generateReport } from 'css-ghost';
 *
 * const results = scan(['/absolute/path/to/src']);
 * const { totalAllOrphans } = generateReport(results, 'orphan-report.md');
 * if (totalAllOrphans > 0) process.exit(1);
 */

export { scan } from './scanner.js';
export { generateReport } from './reporter.js';
