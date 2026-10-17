import { createInterface } from 'readline';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const CONFIG_FILE = 'css-ghost.config.js';

function ask(rl, question, defaultValue = '') {
  return new Promise(resolve => {
    const hint = defaultValue ? ` (${defaultValue})` : '';
    rl.question(`  ${question}${hint}: `, answer => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function askYesNo(rl, question, defaultValue = false) {
  const hint = defaultValue ? 'Y/n' : 'y/N';
  return new Promise(resolve => {
    rl.question(`  ${question} (${hint}): `, answer => {
      const t = answer.trim().toLowerCase();
      resolve(t ? t === 'y' || t === 'yes' : defaultValue);
    });
  });
}

export async function runInit(cwd = process.cwd()) {
  const configPath = join(cwd, CONFIG_FILE);
  const exists = existsSync(configPath);

  console.log(`
👻 css-ghost — Config wizard

This creates ${CONFIG_FILE} in your project root.
Run css-ghost with no arguments once it exists.
`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // Guard against overwriting an existing config
  if (exists) {
    const overwrite = await askYesNo(rl, `⚠️  ${CONFIG_FILE} already exists. Overwrite?`, false);
    if (!overwrite) {
      console.log('\n❌ Cancelled — existing config kept.\n');
      rl.close();
      return;
    }
    console.log('');
  }

  // ── Questions ──────────────────────────────────────────────────────────────

  const dirsRaw = await ask(rl, 'Directories to scan (comma-separated)', './src');
  const dirs = dirsRaw.split(',').map(d => d.trim()).filter(Boolean);

  const output = await ask(rl, 'Report output path', 'orphan-report.md');

  const ignoreRaw = await ask(rl, 'Directories to ignore, e.g. legacy,vendor (blank = none)', '');
  const ignore = ignoreRaw ? ignoreRaw.split(',').map(d => d.trim()).filter(Boolean) : [];

  console.log('');
  const strict     = await askYesNo(rl, 'Enable strict mode?  (exit 1 when orphans found — great for CI)', false);
  const ghostTrail = await askYesNo(rl, 'Enable ghost trail?  (show last git commit per orphan)', false);
  const ai         = await askYesNo(rl, 'Enable AI summary?   (requires css-ghost --setup first)', false);

  rl.close();

  // ── Generate config ────────────────────────────────────────────────────────

  const dirsLiteral   = JSON.stringify(dirs);
  const ignoreLiteral = ignore.length ? JSON.stringify(ignore) : '[]';

  const content = `// css-ghost.config.js
// Configuration for css-ghost — https://www.npmjs.com/package/css-ghost
//
// Place this file in your project root and run \`css-ghost\` with no arguments.
// CLI flags always override values set here.

export default {
  // Directories to scan. Supports multiple paths.
  // Equivalent to: css-ghost ./src ./components
  dirs: ${dirsLiteral},

  // Where to write the orphan report.
  // Equivalent to: css-ghost --output ${output}
  output: ${JSON.stringify(output)},

  // Directory names to skip — additive on top of the built-in list.
  // Built-in: node_modules, .git, dist, build, .next, out, coverage, .cache
  ignore: ${ignoreLiteral},

  // Exit with code 1 when orphans are found — useful in CI pipelines.
  // Equivalent to: css-ghost --strict
  strict: ${strict},

  // Show the last git commit that touched each orphaned selector.
  // Equivalent to: css-ghost --ghost-trail
  ghostTrail: ${ghostTrail},

  // Append an AI-generated summary to the report (requires css-ghost --setup).
  // Equivalent to: css-ghost --ai
  ai: ${ai},
};
`;

  writeFileSync(configPath, content, 'utf-8');

  console.log(`
✅ Created ${CONFIG_FILE}

Next steps:

  css-ghost              # scan using your new config
  css-ghost --init       # re-run this wizard to update the config
  css-ghost --help       # see all options
`);
}
