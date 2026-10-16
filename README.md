# 👻 css-ghost

Find and remove unused CSS selectors and orphaned CSS custom properties — selectors defined in your style files but never referenced in your components, across React, Vue, Svelte, SCSS, and CSS Modules.

## What it does

Scans one or more directories for style files, extracts every class selector defined, then cross-references them against usages in your component files. Anything defined but never used is reported as an orphan — with its line number and the actual CSS rule printed inline.

**Supported style files:** `.css`, `.module.css`, `.scss`, `.sass`, `.less`, `.js`/`.ts` (StyleSheet.create, makeStyles, vanilla-extract)

**Detected usage patterns:** `className="foo"`, `styles.foo`, `styles['foo']`, ternary branches, `cx()`/`clsx()`/`classnames()`, object keys, array literals, MUI `classes.foo`, vanilla-extract named imports, and more.

**Dynamic class detection:**
Patterns where the class name is unknowable at parse time — `styles[variable]` or template literals with `${}` — are flagged with a ⚠️ warning. All statically resolvable patterns are analysed without warnings.

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

| Flag                  | Description                                          | Default            |
| --------------------- | ---------------------------------------------------- | ------------------ |
| `--output <file>`     | Output report file path                              | `orphan-report.md` |
| `--delete`            | Delete all orphaned selectors from source files      | off                |
| `--yes`               | Skip the deletion confirmation prompt                | off                |
| `--strict`            | Exit with code 1 when any orphans are found (CI use) | off               |
| `--ghost-trail`       | Show the last git commit that touched each orphan    | off                |
| `--install-hook`      | Write a pre-commit hook to `.git/hooks/pre-commit`   | —                  |
| `--ai`                | Append an AI-generated summary (requires setup)      | off                |
| `--setup`             | Save your OpenRouter API key for `--ai`              | —                  |
| `-h, --help`          | Show help                                            | —                  |

## Examples

```bash
css-ghost                          # interactive folder picker
css-ghost ./src
css-ghost ./src ./components
css-ghost ./src --ghost-trail      # show git history for each orphan
css-ghost ./src --strict           # exit 1 when orphans found (CI mode)
css-ghost ./src --delete
css-ghost ./src --delete --yes
css-ghost --install-hook ./src     # install pre-commit hook for ./src
css-ghost ./src --ai
css-ghost ./src --output ./reports/css-audit.md
```

## CSS variable orphan detection

css-ghost also catches **orphaned CSS custom properties** — variables defined with `--my-token: value` but never consumed anywhere via `var(--my-token)`.

Usages are detected across all file types: CSS, SCSS, JS, TS, JSX, TSX, Vue, Svelte, HTML. A variable defined in `variables.css` and used in a React component is correctly seen as _used_.

```
   🔮 --colour-danger-hover (line 8)
      --colour-danger-hover: #dc2626;

   🔮 --spacing-xl (line 26)
      --spacing-xl: 64px;
```

Orphaned variables appear under a separate **🔮 Orphaned CSS variables** section in both terminal and markdown output.

---

## Ghost trail — git history for orphans

Pass `--ghost-trail` to fetch the last git commit that changed each orphan's occurrence count. Class searches are limited to component file types so results reflect _usage_ history, not definition history.

```bash
css-ghost ./src --ghost-trail
```

```
   👻 .iconRight (line 28)
      🕵️  b5c6efb · Roland Levy · 3 weeks ago — "Refactor Button component"
      .iconRight { margin-left: 6px; }
```

> **Note:** Runs one `git log -S` per orphan in parallel — may take a few seconds on large histories.

---

## Pre-commit hook

Install a hook that blocks commits when orphaned selectors are present:

```bash
css-ghost --install-hook ./src
```

This writes `.git/hooks/pre-commit` (executable, `chmod 755`). Pass multiple directories the same way you would to a normal scan. To uninstall: `rm .git/hooks/pre-commit`

### `--strict` flag

Makes css-ghost exit with code 1 when any orphans are found — powers the hook, and also useful standalone in CI:

```bash
css-ghost ./src --strict
```

---

## Interactive folder picker

Run `css-ghost` with no arguments to open an arrow-key folder picker in your terminal. Navigate to any folder, press `a` to add it to the scan list, then `d` to start the scan. You can add multiple folders before pressing `d`.

## Deleting orphans

```bash
css-ghost ./src --delete        # prompts for confirmation
css-ghost ./src --delete --yes  # skips confirmation (CI / scripts)
```

> **Tip:** commit or stash your work before running `--delete`. There is no undo.

## To enable AI features

Run the setup wizard once to save a free [OpenRouter](https://openrouter.ai) API key:

```bash
css-ghost --setup
```

Then pass `--ai` to any scan to append a plain English summary to the report. The core scan always runs without a key.

## Dependencies

One runtime dependency: [`picocolors`](https://github.com/alexeyraspopov/picocolors). Everything else uses Node.js built-ins.

## License

[MIT](./LICENSE)
