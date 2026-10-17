# 👻 css-ghost

[![npm version](https://img.shields.io/npm/v/css-ghost.svg)](https://www.npmjs.com/package/css-ghost)
[![npm downloads](https://img.shields.io/npm/dm/css-ghost.svg)](https://www.npmjs.com/package/css-ghost)
[![CI](https://github.com/rolandjlevy/css-ghost/actions/workflows/ci.yml/badge.svg)](https://github.com/rolandjlevy/css-ghost/actions/workflows/ci.yml)
[![Node.js >=18](https://img.shields.io/node/v/css-ghost.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/rolandjlevy/css-ghost/blob/main/LICENSE)

Find and remove unused CSS selectors and orphaned CSS custom properties — selectors defined in your style files but never referenced in your components, across React, Vue, Svelte, SCSS, and CSS Modules

## What it does

Scans one or more directories for style files, extracts every class selector defined, then cross-references them against usages in your component files. Anything defined but never used is reported as an orphan — with its line number and the actual CSS printed inline.

**Supported style files:** `.css`, `.module.css`, `.scss`, `.sass`, `.less`, `.js`/`.ts` using `StyleSheet.create({})` / `makeStyles({})` (MUI), `.css.ts`/`.css.js` using `style()` or `styleVariants()` (vanilla-extract)

**Detected usage patterns:** `className="foo"`, `className={styles.foo}`, `styles['foo']`, ternary patterns, `cx()` / `clsx()` / `classnames()` (strings, objects and arrays), `classes.foo` (MUI), vanilla-extract named imports, Vue `:class` bindings, Svelte `class:name` directives

**Dynamic class detection:** Patterns where the class name can't be resolved statically — `styles[variable]` or template literals with `${}` — are flagged with a ⚠️ warning per file in both the terminal output and the Markdown report.

## Example output

![css-ghost demo](./docs/demo.gif)

When a component uses dynamic class access (`styles[variant]`), the file is flagged rather than reporting false positives:

```
✅ src/components/alert.module.css

   ⚠️  Dynamic class references detected — results may be incomplete.
   Dynamic references in: src/components/Alert.jsx

   👻 .hidden (line 30)
      .hidden { display: none; }
```

---

## How is this different from PurgeCSS?

[PurgeCSS](https://www.npmjs.com/package/purgecss) is a **build-time bundler** — it hooks into webpack, PostCSS, or Gulp to strip unused CSS from your production output. It's designed for removing large framework utility classes (Bootstrap, Tailwind) that you never use.

css-ghost is a **source code auditor** — it finds dead selectors in your actual codebase, with no build step and no config file required. Just point it at a folder:

```bash
npx @rolandjlevy/css-ghost ./src
```

|                             | PurgeCSS                      | css-ghost        |
| --------------------------- | ----------------------------- | ---------------- |
| Works on source files       | ❌ Build output only          | ✅               |
| Zero config, no build step  | ❌ Requires webpack / PostCSS | ✅               |
| CSS custom property orphans | ❌                            | ✅               |
| Git history per orphan      | ❌                            | ✅               |
| Pre-commit hook             | ❌                            | ✅               |
| Deletes dead code for you   | ❌                            | ✅               |
| MUI / vanilla-extract aware | ❌                            | ✅               |
| Safe with dynamic classes   | ❌ Silently removes them      | ✅ Flags with ⚠️ |

The two tools are complementary: PurgeCSS for trimming framework output at build time; css-ghost for auditing your own hand-written CSS throughout development.

---

## To enable AI features

Run the setup wizard once to save your free [OpenRouter](https://openrouter.ai) API key ([openrouter.ai/keys](https://openrouter.ai/keys)), then pass `--ai` to any scan:

```bash
css-ghost --setup
css-ghost ./src --ai
```

The AI summary appears in both the terminal output and the markdown report. The core scan always runs without a key.

## Install

```bash
npm install -g @rolandjlevy/css-ghost
```

Or run without installing:

```bash
npx @rolandjlevy/css-ghost ./src
```

## Usage

```bash
css-ghost [directory] [directory2] ... [options]
```

**Options:**

| Flag              | Description                                          | Default            |
| ----------------- | ---------------------------------------------------- | ------------------ |
| `--output <file>` | Output report file path                              | `orphan-report.md` |
| `--delete`        | Delete all orphaned selectors from source files      | off                |
| `--yes`           | Skip the deletion confirmation prompt                | off                |
| `--strict`        | Exit with code 1 when any orphans are found (CI use) | off                |
| `--ghost-trail`   | Show the last git commit that touched each orphan    | off                |
| `--install-hook`  | Write a pre-commit hook to `.git/hooks/pre-commit`   | —                  |
| `--ai`            | Append an AI-generated summary (requires setup)      | off                |
| `--setup`         | Save your OpenRouter API key for `--ai`              | —                  |
| `-h, --help`      | Show help                                            | —                  |

## CSS variable orphan detection

css-ghost also catches **orphaned CSS custom properties** — variables defined with `--my-token: value` but never consumed via `var(--my-token)` anywhere in the codebase. Usages are detected across all file types: CSS, SCSS, JS, TS, JSX, TSX, Vue, Svelte, HTML. Orphaned variables appear under a **🔮 Orphaned CSS variables** section in both the terminal output and the markdown report.

## Ghost trail — git history for orphans

Pass `--ghost-trail` to fetch the last git commit that changed each orphan's occurrence count:

```bash
css-ghost ./src --ghost-trail
```

> **Note:** ghost trail runs one `git log -S` per orphan in parallel. On large histories with many orphans it may take a few seconds.

## Pre-commit hook

Install a hook that blocks commits when orphaned selectors are present:

```bash
css-ghost --install-hook ./src
```

This writes `.git/hooks/pre-commit` (executable, `chmod 755`). Pass multiple directories the same way you would to a normal scan. To uninstall: `rm .git/hooks/pre-commit`

### `--strict` flag

Exit with code 1 when any orphans are found — the mechanism the hook depends on, also useful in CI:

```bash
css-ghost ./src --strict
```

## Interactive folder picker

Run `css-ghost` with no arguments to open an arrow-key picker. Navigate with `↑↓`, enter with `↵`, press `a` to add the current folder to the scan list, `d` to start the scan. Add multiple folders before pressing `d`.

## Deleting orphans

```bash
css-ghost ./src --delete        # prints report, then asks for confirmation
css-ghost ./src --delete --yes  # skip the prompt (CI / scripts)
```

> **Tip:** commit or stash your work before running `--delete`. There is no undo.

## Examples

```bash
css-ghost                              # interactive folder picker
css-ghost ./src                        # scan a folder
css-ghost ./src --ghost-trail          # show git history per orphan
css-ghost ./src --strict               # CI: exit 1 on any orphan
css-ghost --install-hook ./src         # install pre-commit hook
css-ghost ./src --delete               # remove orphans (with prompt)
css-ghost ./src --delete --yes         # remove without prompting
css-ghost ./src ./components ./pages   # scan multiple directories
css-ghost ./src --ai                   # with AI summary
css-ghost ./src --output ./reports/audit.md
```

## Programmatic API

Use css-ghost as a library inside your own build tools, Vite plugins, or scripts:

```bash
npm install @rolandjlevy/css-ghost
```

```js
import { scan, generateReport } from '@rolandjlevy/css-ghost';
import { resolve } from 'path';

// Scan one or more directories
const results = scan([resolve(process.cwd(), 'src')]);

// Optional: write a Markdown report and get the orphan totals
const { totalAllOrphans } = generateReport(results, 'orphan-report.md');

// Use in CI: fail the build if any orphans are found
if (totalAllOrphans > 0) process.exit(1);
```

TypeScript types are included — no `@types/` package needed.

**`scan(dirs: string[])`** — returns a `ScanResult[]` array, one entry per style file. Each entry includes `filePath`, `orphaned` selectors, `orphanedVars` (CSS custom properties), `hasDynamic` flag, and more.

**`generateReport(results, outputPath?, aiSummary?)`** — writes a Markdown report and prints a colour summary to the terminal. Returns `{ totalOrphaned, totalVarsOrphaned, totalAllOrphans }`.

## Using with npm scripts

```json
"scripts": {
  "scan": "css-ghost ./src"
}
```

```bash
npm run scan -- --output ./reports/audit.md
```

## Dependencies

One runtime dependency: [`picocolors`](https://github.com/alexeyraspopov/picocolors) for terminal colours. Everything else uses Node.js built-ins (`fs`, `path`, `readline`).

## License

[MIT](./LICENSE)
