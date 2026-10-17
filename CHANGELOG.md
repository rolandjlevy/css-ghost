# Changelog

All notable changes to `@rolandjlevy/css-ghost` are documented here.

---

## [1.3.0] — 2026-10-17

### Added

- **Programmatic API** (`src/index.js`) — `scan()` and `generateReport()` are now exposed as the package's public entry point via the `exports` field. Other tools and build plugins can now depend on css-ghost directly.
- **TypeScript types** (`index.d.ts`) — hand-authored declarations for `ScanResult`, `OrphanedItem`, `GhostTrail`, and `ReportTotals`; no `@types/` package needed.
- **GitHub Actions CI** (`.github/workflows/ci.yml`) — runs the smoke test suite on Node 18, 20 and 22 on every push and pull request.
- **Smoke test runner** (`test/run.js`) — `npm test` now runs `scan()` against all 13 fixture directories and asserts result shapes; 13/13 pass.
- **README badges** — npm version, monthly downloads, CI status, Node version and licence badge at the top of the README.
- **Programmatic API docs** — new README section with install instructions, usage example, and TypeScript note.
- **Keywords expanded** — added `vite`, `webpack`, `postcss`, `css-variables`, `vanilla-extract`, `orphaned-selectors` for better npm discovery.

---

## [1.2.0] — 2026-10-17

### Fixed

- **SASS indented syntax** (`src/parser.js`) — `.sass` files previously returned 0 selectors because the parser required `{` to open a rule block. A new `extractSassIndentedSelectors()` branch parses the indentation-based syntax correctly, detecting top-level class selectors and collecting their rule bodies from the indented lines that follow.

- **Vue and Svelte components not scanned** (`src/walker.js`) — `.vue` and `.svelte` files were excluded from the component walk, causing all selectors used only in Vue SFCs or Svelte components to appear as false positives. Both extensions are now included in `COMPONENT_EXTENSIONS`.

- **`hasDynamic` flag contaminating unrelated files** (`src/scanner.js`) — when any component anywhere in the scan used `styles[variable]` or a template literal, every style file in the entire scan was tagged `hasDynamic: true`. The flag and the `dynamicFiles` list are now scoped to style files that share a directory with the dynamic component.

- **Terminal output missing dynamic warning** (`src/reporter.js`) — the `⚠️ Dynamic class references detected` message appeared in the Markdown report but not in the terminal output. The warning now appears inline per file in the terminal, matching the Markdown behaviour.

### Added

- Comprehensive CLI test fixtures under `test/` covering all documented use-cases: SCSS, LESS, SASS indented syntax, React Native `StyleSheet.create()`, dynamic class access, hyphenated selectors, `clsx` (strings/objects/arrays), Vue SFC `:class` bindings, and Svelte `class:name` directives.

---

## [1.1.3] — 2026-10-16

- Internal release; no public changelog entry.

---

## [1.1.0] — 2026-10-01

### Added

- `--ghost-trail` flag: shows the last git commit that touched each orphaned selector
- `--ai` flag: appends an AI-generated summary via OpenRouter (run `--setup` once to save your key)
- CSS custom property orphan detection (`--my-token` defined but never consumed via `var(--my-token)`)
- `--install-hook` flag: writes a pre-commit hook that blocks commits when orphans are present

---

## [1.0.0] — 2026-09-01

### Initial release

- CSS selector orphan detection across `.css`, `.module.css`, `.scss`, `.sass`, `.less`, and JS style files (`StyleSheet.create`, `makeStyles`, vanilla-extract)
- `--delete` / `--delete --yes` to remove orphaned selectors from source files
- `--strict` flag for CI (exit code 1 when any orphans found)
- `--output <file>` for custom Markdown report paths
- Interactive folder picker when run with no arguments
