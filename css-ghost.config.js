// css-ghost.config.js
// Configuration for css-ghost — https://www.npmjs.com/package/css-ghost
//
// Place this file in your project root and run `css-ghost` with no arguments.
// CLI flags always override values set here.

export default {
  // Directories to scan. Supports multiple paths.
  // Equivalent to: css-ghost ./src ./components
  dirs: ['./src'],

  // Where to write the orphan report.
  // Equivalent to: css-ghost --output orphan-report.md
  output: 'orphan-report.md',

  // Directory names to skip — additive on top of the built-in list.
  // Built-in: node_modules, .git, dist, build, .next, out, coverage, .cache
  ignore: [],

  // Exit with code 1 when orphans are found — useful in CI pipelines.
  // Equivalent to: css-ghost --strict
  strict: false,

  // Show the last git commit that touched each orphaned selector.
  // Equivalent to: css-ghost --ghost-trail
  ghostTrail: false,

  // Append an AI-generated summary to the report (requires css-ghost --setup).
  // Equivalent to: css-ghost --ai
  ai: false,
};
