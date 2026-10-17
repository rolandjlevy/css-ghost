import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

const CONFIG_FILES = ['css-ghost.config.js', '.css-ghostrc.json'];

const VALID_KEYS = new Set([
  'dirs', 'output', 'ignore', 'strict', 'ghostTrail', 'ai', 'delete', 'yes',
]);

/**
 * Search cwd for a config file (css-ghost.config.js then .css-ghostrc.json).
 * Returns { config, configPath } — config is {} and configPath is null when
 * no file is found.
 */
export async function loadConfig(cwd = process.cwd()) {
  for (const filename of CONFIG_FILES) {
    const filePath = join(cwd, filename);
    if (!existsSync(filePath)) continue;

    try {
      let raw;
      if (filename.endsWith('.json')) {
        raw = JSON.parse(readFileSync(filePath, 'utf-8'));
      } else {
        // ESM dynamic import — pathToFileURL handles Windows paths too
        const mod = await import(pathToFileURL(filePath).href);
        raw = mod.default ?? mod;
      }

      const config = validateConfig(raw, filename);
      return { config, configPath: filePath };
    } catch (err) {
      console.error(`⚠️  Could not load ${filename}: ${err.message}\n`);
      return { config: {}, configPath: null };
    }
  }

  return { config: {}, configPath: null };
}

function validateConfig(raw, filename) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`Config must export a plain object`);
  }

  const unknown = Object.keys(raw).filter(k => !VALID_KEYS.has(k));
  if (unknown.length) {
    console.warn(`⚠️  Unknown config key${unknown.length > 1 ? 's' : ''} in ${filename}: ${unknown.join(', ')}\n`);
  }

  // Type-check known keys
  if (raw.dirs !== undefined && !Array.isArray(raw.dirs)) {
    throw new Error(`'dirs' must be an array of strings`);
  }
  if (raw.ignore !== undefined && !Array.isArray(raw.ignore)) {
    throw new Error(`'ignore' must be an array of strings`);
  }
  if (raw.output !== undefined && typeof raw.output !== 'string') {
    throw new Error(`'output' must be a string`);
  }

  return raw;
}

/**
 * Merge CLI-parsed options with config file values.
 * CLI flags always win; config fills in what wasn't supplied on the command line.
 *
 * @param {object} cli    - values extracted from process.argv
 * @param {object} config - values from the config file (may be {})
 */
export function mergeConfig(cli, config) {
  return {
    // dirs: CLI positional args win; config.dirs is the fallback
    dirs:        cli.dirs?.length       ? cli.dirs       : (config.dirs ?? []),

    // output: CLI --output wins; config.output fallback; then hardcoded default
    output:      cli.output             ?? config.output  ?? 'orphan-report.md',

    // boolean flags: CLI presence wins (true); config value is fallback; default false
    strict:      cli.strict             || config.strict      || false,
    ghostTrail:  cli.ghostTrail         || config.ghostTrail  || false,
    ai:          cli.ai                 || config.ai          || false,
    doDelete:    cli.doDelete           || config.delete      || false,
    skipConfirm: cli.skipConfirm        || config.yes         || false,

    // ignore: config-only for now (no CLI equivalent); always additive
    ignore:      Array.isArray(config.ignore) ? config.ignore : [],
  };
}
