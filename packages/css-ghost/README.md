# 👻 css-ghost

[![npm version](https://img.shields.io/npm/v/css-ghost.svg)](https://www.npmjs.com/package/css-ghost)
[![npm downloads](https://img.shields.io/npm/dm/css-ghost.svg)](https://www.npmjs.com/package/css-ghost)
[![CI](https://github.com/rolandjlevy/css-ghost/actions/workflows/ci.yml/badge.svg)](https://github.com/rolandjlevy/css-ghost/actions/workflows/ci.yml)
[![Node.js >=18](https://img.shields.io/node/v/css-ghost.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/rolandjlevy/css-ghost/blob/main/LICENSE)

Find and remove **unused CSS selectors** and **orphaned CSS custom properties** — selectors defined in your style files but never referenced in your components.

Works with React, Vue, Svelte, SCSS, LESS, SASS, CSS Modules, MUI, and vanilla-extract.

---

## Install

```bash
npm install -g css-ghost
```

Or run without installing:

```bash
npx css-ghost ./src
```

---

## CLI usage

```bash
css-ghost ./src                        # scan a folder
css-ghost ./src --strict               # exit 1 on any orphan (great for CI)
css-ghost ./src --ghost-trail          # show git history per orphan
css-ghost ./src --delete               # remove orphans interactively
css-ghost ./src --delete --yes         # remove without prompting
css-ghost ./src ./components ./pages   # scan multiple directories
css-ghost ./src --output ./reports/audit.md
css-ghost --install-hook ./src         # install a pre-commit hook
css-ghost                              # interactive folder picker
```

---

## Programmatic API

```bash
npm install css-ghost
```

```js
import { scan, generateReport } from 'css-ghost';
import { resolve } from 'path';

const results = scan([resolve(process.cwd(), 'src')]);
const { totalAllOrphans } = generateReport(results, 'orphan-report.md');

// Fail CI if orphans found
if (totalAllOrphans > 0) process.exit(1);
```

TypeScript types are included — no `@types/` package needed.

---

## What it detects

**Supported style files:** `.css`, `.module.css`, `.scss`, `.sass`, `.less`, `.css.ts` / `.css.js` (vanilla-extract), `.js` / `.ts` using `StyleSheet.create()` (React Native) or `makeStyles()` (MUI)

**Detected usage patterns:** `className="foo"`, `className={styles.foo}`, `styles['foo']`, `cx()` / `clsx()` / `classnames()`, Vue `:class` bindings, Svelte `class:name` directives, MUI `classes.foo`, vanilla-extract named imports

**Dynamic class detection:** Patterns like `styles[variable]` that can't be resolved statically are flagged with a ⚠️ warning rather than reported as false positives.

**CSS variable orphans:** Finds `--custom-properties` defined but never consumed via `var()`.

---

## Example output

```
📊 3 orphaned selectors · 1 orphaned CSS variable in 2 files. See: orphan-report.md
💾 Potential savings: 420 B minified

✅ src/components/card.module.css

   👻 .cardHeader (line 14)
      .cardHeader { font-size: 1.25rem; font-weight: 600; }

   👻 .cardFooter (line 28)
      .cardFooter { border-top: 1px solid var(--border); padding-top: 1rem; }

✅ src/styles/tokens.css

   🔮 --color-surface-alt (line 12)
      --color-surface-alt: #f5f5f5;
```

---

## Links

- [GitHub repository](https://github.com/rolandjlevy/css-ghost)
- [Full documentation & changelog](https://github.com/rolandjlevy/css-ghost#readme)
- [npm: @rolandjlevy/css-ghost](https://www.npmjs.com/package/@rolandjlevy/css-ghost) (scoped alias)

---

## License

MIT © [Roland Levy](https://github.com/rolandjlevy)
