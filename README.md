# 👻 css-ghost

Find orphaned CSS class selectors in your codebase — defined in style files but never referenced in your components.

## What it does

Scans one or more directories for style files, extracts every class selector defined, then cross-references them against usages in your component files. Anything defined but never used is reported as an orphan — with its line number and the actual CSS printed inline.

**Supported style files:**
- `.css`, `.module.css`, `.scss`, `.sass`, `.less`
- `.js` / `.ts` files using `StyleSheet.create({})` or named style objects

**Detected usage patterns:**
- `className="foo"`
- `className={styles.foo}`
- `styles['foo']`
- `cx('foo')`, `clsx('foo')`, `classnames('foo')`

**Dynamic class detection:**
Files containing `styles[variable]` or template literal class names are flagged with a ⚠️ warning — results for those files may be incomplete.

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
css-ghost <directory> [directory2] ... [options]
```

**Options:**

| Flag | Description | Default |
| --- | --- | --- |
| `--output <file>` | Output report file path | `orphan-report.md` |
| `-h, --help` | Show help | — |

## Examples

```bash
# Scan your src folder
css-ghost ./src

# Scan multiple directories
css-ghost ./src ./components ./pages

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

## No dependencies

Built with Node.js built-ins only (`fs`, `path`). No npm packages required.

## Origin — built with OpenRouter free models via Claude Code

This tool was created as a test project to explore [using OpenRouter's free model tier with Claude Code](https://www.mindstudio.ai/blog/open-router-free-models-claude-code-cost-reduction) as a way to cut AI development costs.

Claude Code normally calls Anthropic's API directly. By overriding two environment variables you can route it through OpenRouter's free tier instead — meaning you can run agentic coding sessions at no cost using models like Llama 3.3 70B or Deepseek R1.

### Setup

Get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys), then add these aliases to your `~/.zshrc`:

```bash
# Store your key once
export OPENROUTER_API_KEY="sk-or-v1-YOUR_KEY"

# Llama 3.3 70B — fast, capable, free
alias claude-free='ANTHROPIC_BASE_URL="https://openrouter.ai/api/v1" \
  ANTHROPIC_API_KEY="$OPENROUTER_API_KEY" \
  claude --model "meta-llama/llama-3.3-70b-instruct:free"'

# Deepseek R1 — strongest free option for reasoning and debugging
alias claude-r1='ANTHROPIC_BASE_URL="https://openrouter.ai/api/v1" \
  ANTHROPIC_API_KEY="$OPENROUTER_API_KEY" \
  claude --model "deepseek/deepseek-r1:free"'
```

Then `source ~/.zshrc`. Use `claude-free` or `claude-r1` in place of `claude` to start a free session.

> **Note:** Free tier models handle Claude Code's tool call format well in practice, but run a quick agentic task first to confirm file read/edit/bash loops work end to end in your environment before committing to it for serious work.

## License

MIT
