# 👻 css-ghost

Find orphaned CSS class selectors in your codebase — defined in style files but never referenced in your components.

## What it does

Scans one or more directories for style files, extracts every class selector defined, then cross-references them against usages in your component files. Anything defined but never used is reported as an orphan — with its line number and the actual CSS printed inline.

**Supported style files:**

- `.css`, `.module.css`, `.scss`, `.sass`, `.less`
- `.js` / `.ts` files using `StyleSheet.create({})`, `makeStyles({})` (MUI), or named style objects
- `.css.ts` / `.css.js` files using `style()` or `styleVariants()` (vanilla-extract)

**Detected usage patterns:**

- `className="foo"`
- `className={styles.foo}`
- `styles['foo']`
- `styles[condition ? 'foo' : 'bar']` — both branches extracted
- `cx('foo')`, `clsx('foo')`, `classnames('foo')`
- `cx({ active: isOn, disabled: true })` — object keys extracted
- `cx(['foo', condition && 'bar'])` — array string literals extracted
- `classes.foo` — MUI `makeStyles` / `useStyles` convention
- `import { foo } from './styles.css'` — vanilla-extract named imports

**Dynamic class detection:**
Patterns where the class name is truly unknowable at parse time — `styles[variable]` or template literals containing `${}` — are flagged with a ⚠️ warning. All statically resolvable patterns (string literals, ternaries, object keys) are analysed without warnings.

## To enable AI features

css-ghost can generate a plain English summary of your orphaned selectors using a free [OpenRouter](https://openrouter.ai) API key. Run the setup wizard once:

```bash
css-ghost --setup
```

It will prompt you to paste your key (free at [openrouter.ai/keys](https://openrouter.ai/keys)) and save it to `~/.css-ghost`. Then pass `--ai` to any scan:

```bash
css-ghost ./src --ai
```

The AI summary appears in both the terminal output and the markdown report. The core scan always runs without a key — `--ai` is entirely optional.

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

css-ghost also catches **orphaned CSS custom properties** — variables defined with `--my-token: value` but never consumed anywhere via `var(--my-token)`.

Usages are detected across all file types: CSS, SCSS, JS, TS, JSX, TSX, Vue, Svelte, HTML. A variable defined in `variables.css` and used in a React component is correctly seen as _used_.

```
   🔮 --colour-danger-hover (line 8)
      --colour-danger-hover: #dc2626;

   🔮 --spacing-xl (line 26)
      --spacing-xl: 64px;
```

Orphaned variables appear under a separate **🔮 Orphaned CSS variables** section in both the terminal output and the markdown report.

---

## Ghost trail — git history for orphans

Pass `--ghost-trail` to fetch the last git commit that changed each orphan's occurrence count in the codebase. For class-name orphans the search is limited to component file types (`.tsx`, `.jsx`, `.ts`, `.js`, etc.) so the result reflects _usage_ history rather than the style-file definition.

```bash
css-ghost ./src --ghost-trail
```

```
   👻 .iconRight (line 28)
      🕵️  b5c6efb · Roland Levy · 3 weeks ago — "Refactor Button component"
      .iconRight {
        margin-left: 6px;
      }
```

For CSS variables the search looks for `var(--name` across all file types.

> **Note:** ghost trail runs one `git log -S` per orphan in parallel. On large histories with many orphans it may take a few seconds.

---

## Pre-commit hook

Install a hook that blocks commits when orphaned selectors are present:

```bash
css-ghost --install-hook ./src
```

This writes `.git/hooks/pre-commit` (executable, `chmod 755`) containing:

```sh
#!/bin/sh
echo "👻  css-ghost — checking for orphaned CSS selectors..."
npx --yes @rolandjlevy/css-ghost ./src --strict --output /tmp/css-ghost-hook-report.md

if [ $? -ne 0 ]; then
  echo "❌  Commit blocked: orphaned CSS selectors found"
  echo "    Run 'css-ghost ./src --delete' to remove them"
  echo "    Or skip: git commit --no-verify"
  exit 1
fi
```

Pass multiple directories to the hook installer the same way you would to a normal scan:

```bash
css-ghost --install-hook ./src ./components ./pages
```

To uninstall: `rm .git/hooks/pre-commit`

### `--strict` flag

`--strict` makes css-ghost exit with code 1 when any orphans are found — the mechanism the hook depends on, but also useful in CI workflows independently:

```bash
# In CI: fail the build if orphans exist
css-ghost ./src --strict
```

---

## Interactive folder picker

Run `css-ghost` with no arguments and an arrow-key picker opens in your terminal:

```
📂 Directory picker  — navigate into a folder, then press [a] to add it

📍 /home/user/my-project

    📁 components
  ▶  📁 src
    📁 styles

✅ Added to scan:
   /home/user/my-project/src

[↑↓/jk] navigate  [↵/→] enter  [←] parent  [a] add current dir  [d] done  [^C] quit
```

| Key                    | Action                                  |
| ---------------------- | --------------------------------------- |
| `↑` / `↓` or `k` / `j` | Move up and down the folder list        |
| `↵` or `→`             | Enter the highlighted folder            |
| `←` or Backspace       | Go up to the parent folder              |
| `a`                    | Add the current folder to the scan list |
| `d`                    | Done — start the scan                   |
| `Ctrl+C`               | Quit without scanning                   |

You can add **multiple folders** before pressing `d` — just navigate to each one and press `a`. If you press `d` without adding anything, the folder you're currently browsing is used.

## Deleting orphans

Pass `--delete` after a scan to remove every flagged selector directly from its source file:

```bash
css-ghost ./src --delete
```

css-ghost prints the full report first, then lists what will be deleted and asks for confirmation before touching anything. Pass `--yes` to skip the prompt (useful in CI or scripts):

```bash
css-ghost ./src --delete --yes
```

Works across all supported file types — `.css`, `.scss`, `.less`, MUI `makeStyles`, and vanilla-extract exports.

> **Tip:** commit or stash your work before running `--delete`. There is no undo.

## Examples

```bash
# Interactive folder picker (no args)
css-ghost

# Scan your src folder
css-ghost ./src

# Show git history for each orphan
css-ghost ./src --ghost-trail

# Fail with exit code 1 when orphans exist (CI)
css-ghost ./src --strict

# Install a pre-commit hook that scans ./src
css-ghost --install-hook ./src

# Scan and delete all orphans (with confirmation prompt)
css-ghost ./src --delete

# Scan and delete without prompting
css-ghost ./src --delete --yes

# Scan multiple directories
css-ghost ./src ./components ./pages

# With AI summary
css-ghost ./src --ai

# Write report to a custom path
css-ghost ./src --output ./reports/css-audit.md
```

## CLI output

Running `css-ghost ./src` prints a live summary to your terminal:

```
✅ Report written to orphan-report.md
📊 3 orphaned selectors across 1 file

📄 src/components/Button/Button.module.css
   👻 .iconLeft (line 4)
      .iconLeft {
        margin-right: 6px;
        flex-shrink: 0;
      }

   👻 .loadingSpinner (line 12)
      .loadingSpinner {
        animation: spin 0.8s linear infinite;
      }

   👻 .disabled (line 18)
      .disabled {
        opacity: 0.4;
        pointer-events: none;
      }

📁 1 style file scanned
```

Each orphan shows:

- the selector name and the **exact line number** where it's defined
- the **full CSS rule** so you can see what it does before deciding to delete it

## Markdown report

A full report is also written to `orphan-report.md` (or your `--output` path):

---

### 👻 Orphaned selectors

#### `.iconLeft` — line 4

```css
.iconLeft {
  margin-right: 6px;
  flex-shrink: 0;
}
```

#### `.loadingSpinner` — line 12

```css
.loadingSpinner {
  animation: spin 0.8s linear infinite;
}
```

---

## Using with npm scripts

If you're working inside the project itself, add a `scan` script to `package.json`:

```json
"scripts": {
  "scan": "css-ghost ./src"
}
```

Then run:

```bash
npm run scan

# Pass extra args with --
npm run scan -- --output ./reports/audit.md
```

## Troubleshooting

### `css-ghost: command not found` after global install

Your npm global bin directory may not be on your PATH. Run:

```bash
npm bin -g
```

Then add that path to your shell config (`~/.zshrc`, `~/.bashrc`, etc.):

```bash
export PATH="$(npm bin -g):$PATH"
```

Reload with `source ~/.zshrc`. This is a one-time fix — it won't be needed again after that.

> This is common when Node was installed via the official installer rather than nvm or Homebrew.

## Dependencies

One runtime dependency: [`picocolors`](https://github.com/alexeyraspopov/picocolors) for terminal colours. Everything else uses Node.js built-ins (`fs`, `path`, `readline`).

## Origin — built with OpenRouter free models via Claude Code

This tool was created as a test project to explore [using OpenRouter's free model tier with Claude Code](https://www.mindstudio.ai/blog/open-router-free-models-claude-code-cost-reduction) as a way to cut AI development costs.

Claude Code normally calls Anthropic's API directly. By overriding two environment variables you can route it through OpenRouter's free tier instead — meaning you can run agentic coding sessions at no cost.

If you've already run `css-ghost --setup`, you have an OpenRouter key. You can also export it as an environment variable — css-ghost picks it up automatically, so you don't even need `--setup`:

```bash
export OPENROUTER_API_KEY="sk-or-v1-YOUR_KEY"
```

And you can reuse the same key with Claude Code by adding these aliases to your `~/.zshrc`:

```bash
alias claude-free='ANTHROPIC_BASE_URL="https://openrouter.ai/api/v1" \
  ANTHROPIC_API_KEY="$OPENROUTER_API_KEY" \
  claude --model "nvidia/nemotron-3.5-lightning:free"'

alias claude-r1='ANTHROPIC_BASE_URL="https://openrouter.ai/api/v1" \
  ANTHROPIC_API_KEY="$OPENROUTER_API_KEY" \
  claude --model "qwen/qwen3.8-27b:free"'
```

Then `source ~/.zshrc`. Use `claude-free` or `claude-r1` in place of `claude` to start a free session.

> **Note:** Free model availability changes frequently. Browse current options at [openrouter.ai/models](https://openrouter.ai/models?q=free) — filter by `:free`.

## License

MIT

```bash
  .-.
 (o o)
 | O |
 '~~~'
```
