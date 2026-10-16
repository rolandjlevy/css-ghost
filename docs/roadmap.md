# 👻 css-ghost — Roadmap

Areas of planned development and improvement.

---

## VS Code Extension

Build a VS Code extension with the same name and branding as the `css-ghost` CLI (`@rolandjlevy/css-ghost` on npm), reusing the existing `parser.js` and `scanner.js` directly rather than reimplementing them.

See [`docs/vscode-extension.md`](./vscode-extension.md) for the full plan.

---

## Terminal Demo GIF

A polished terminal recording embedded in the README would make the tool much easier to understand at a glance on npm and GitHub.

### Tools

- **asciinema** — records a terminal session to a `.cast` file (text, not video — tiny and portable)
- **agg** — Asciinema GIF Generator; converts a `.cast` file to a `.gif` you can embed or share

### Step 1 — Install asciinema

In your GitHub Codespace terminal:

```bash
pip3 install asciinema --break-system-packages
```

Verify:

```bash
asciinema --version
```

### Step 2 — Install agg

Download the prebuilt binary for Linux (the Codespace runs Ubuntu):

```bash
curl -L https://github.com/asciinema/agg/releases/latest/download/agg-x86_64-unknown-linux-gnu \
  -o /usr/local/bin/agg && chmod +x /usr/local/bin/agg
```

Verify:

```bash
agg --version
```

### Step 3 — Prepare the terminal

Before recording, make the session look clean:

- Set a fixed terminal size: `stty rows 24 cols 100`
- Use a minimal prompt — add this temporarily to your shell:
  ```bash
  export PS1='$ '
  ```
- Clear the screen: `clear`
- Make sure `css-ghost` is installed globally or aliased to `node bin/css-ghost.js`

### Step 4 — Record

```bash
asciinema rec demo.cast --overwrite
```

Run your demo commands — for example:

```
$ css-ghost --help
$ css-ghost ./src
$ css-ghost ./src --delete
```

Press `Ctrl+D` or type `exit` to stop recording.

### Step 5 — Convert to GIF

```bash
agg demo.cast demo.gif
```

Optional flags for a more polished result:

```bash
agg demo.cast demo.gif \
  --font-size 14 \
  --theme monokai \
  --speed 1.5
```

- `--speed` — speeds up pauses between commands so the GIF doesn't drag
- `--theme` — pick from `asciinema`, `dracula`, `monokai`, `solarized-dark`, `solarized-light`
- `--font-size` — default is 14; increase if the text looks small when embedded

### Step 6 — Download from Codespace

In VS Code: right-click `demo.gif` in the Explorer panel → **Download**. Or from the terminal:

```bash
# If you have the GitHub CLI authenticated:
gh codespace cp demo.gif ./demo.gif
```

### Tips for a clean recording

- **Type slowly and deliberately** — asciinema captures real keystrokes; typos show up in the GIF.
- **Trim dead time** — `agg` has an `--idle-time-limit` flag (e.g. `--idle-time-limit 2`) that caps long pauses at 2 seconds.
- **Use a test directory with a few clear orphans** — the output should be short enough to read in the GIF.
- **Record in a new shell** — avoids leaking your real prompt, aliases, or environment noise.
- **Run through the demo once before recording** so you know what to type.

### Embed in the README

Once the GIF is in the repo (e.g. `docs/demo.gif`):

```markdown
![css-ghost demo](./docs/demo.gif)
```

---

## ✅ Shipped

- **CSS variable orphan detection** — `--my-token: value` definitions not consumed by any `var(--my-token)` are flagged in a separate 🔮 section in both terminal and markdown output
- **Ghost trail** — `--ghost-trail` fetches the last git commit that touched each orphan via parallel `git log -S` lookups; class searches are limited to component file types for meaningful results
- **Pre-commit hook installer** — `css-ghost --install-hook ./src` writes `.git/hooks/pre-commit`; the new `--strict` flag (exit 1 on orphans) powers it and also enables CI integration

---

## Other Planned Improvements

### Developer experience

- **`--watch` mode** — re-run the scan automatically when style or component files change; debounced so rapid saves don't hammer the scanner
- **Ignore patterns** — a `.cssghostignore` file (or a `cssGhost.ignore` key in `package.json`) to exclude specific selectors, files, or glob patterns from the report
- **JSON output** — `--format json` dumps the full results object to stdout for piping into other tools, CI pipelines, or a custom dashboard
- **Interactive TUI delete** — instead of deleting everything at once, arrow-key through the orphan list and cherry-pick which ones to remove before confirming
- **Config file** — a `.cssghostrc` (JSON or YAML) or `cssGhost` key in `package.json` that persists flags like `--output`, `--strict`, and ignore patterns so you don't have to repeat them every run
- **Baseline snapshots** — `css-ghost --save-baseline` stores the current orphan list; subsequent runs with `--diff` report only orphans that are _new_ since the baseline, making it practical on codebases that already have technical debt

---

### Detection coverage

- **Unused `@keyframes`** — animation blocks defined with `@keyframes name {}` but never referenced in an `animation` or `animation-name` property anywhere in the codebase; arguably the most invisible dead code in large stylesheets
- **Duplicate class definitions** — flag the same selector defined in more than one file so you can decide which one to keep (common after component migrations)
- **Unused CSS custom properties in JS** — detect `--token` definitions inside `element.style.setProperty('--token', value)` calls that are never read back via `getPropertyValue` or `var()`
- **Styled-components / Emotion / Stitches support** — parse tagged template literals (`` styled.div`...` ``) and `css` helper calls; extract class-equivalent names and check them against the component tree
- **`@layer` dead-layer detection** — flag `@layer` declarations that are defined but never populated, or layers whose rules are entirely orphaned
- **Unused media queries** — `@media` blocks that contain only orphaned selectors (so the whole block can be removed)
- **Deprecated naming patterns** — flag selectors matching configurable patterns like `is-old-*`, `legacy-*`, `deprecated-*`, or `TODO-*` regardless of usage

---

### CI / team tooling

- **GitHub Actions example** — a sample workflow (`css-ghost.yml`) that runs on every PR, fails if orphan count _increases_, and posts a comment with the diff
- **PR diff mode** — compare orphan counts between `HEAD` and the base branch (`--diff-branch main`) so the report shows "3 new orphans introduced, 1 removed" rather than total counts
- **Orphan trend graph** — `--history` reads past `orphan-report.md` files from git and prints or charts the orphan count over time
- **SARIF output** — `--format sarif` emits a Static Analysis Results Interchange Format file that GitHub Code Scanning and VS Code Problems panel can consume natively

---

### Monorepo & framework support

- **Monorepo support** — cross-package usage detection: a style file in `packages/design-system` consumed by `packages/app` is correctly seen as used; powered by reading `package.json` workspace entries
- **Next.js App Router awareness** — distinguish between `page.module.css`, `layout.module.css`, and `global.css`; understand that global selectors are used by the runtime, not by import statements
- **Tailwind coexistence mode** — when Tailwind is detected, skip utility classes from `@apply` that would otherwise look like orphans, and only report on the hand-written non-utility selectors
- **CSS Modules `composes:` graph** — follow `composes: foo from './other.module.css'` chains so composed selectors are not incorrectly flagged as orphaned in the source file

---

### Reporting & integrations

- **HTML report** — `--format html` generates a self-contained interactive page with collapsible file sections, a search box, and one-click copy of the selector name
- **Slack / webhook notify** — `--notify <webhook-url>` posts a summary to a Slack channel (or any webhook) after each scan; useful in scheduled CI jobs
- **Editor links in terminal** — orphan lines printed to the terminal are clickable `vscode://` (or `cursor://`) links that open the exact file and line; no more manual navigation
- **`--annotate` mode** — writes `/* css-ghost: orphan */` comments directly above each orphaned rule in the source file as a gentle in-file reminder without deleting anything
