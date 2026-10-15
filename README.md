# 👻 css-ghost

Find orphaned CSS class selectors in your codebase — defined in style files but never referenced in your components.

## What it does

Scans one or more directories for style files, extracts every class selector defined, then cross-references them against usages in your component files. Anything defined but never used is reported as an orphan.

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
npm install -g css-ghost
```

Or run directly without installing:

```bash
npx css-ghost ./src
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
# Scan a single directory
css-ghost ./src

# Scan multiple directories
css-ghost ./src ./components ./pages

# Custom output path
css-ghost ./src --output ./reports/css-audit.md
```

## Output

Generates a markdown report (`orphan-report.md` by default):

```markdown
# 👻 css-ghost — Orphaned Selector Report

## Summary
| Metric | Value |
| --- | --- |
| Style files scanned | 12 |
| Total selectors defined | 84 |
| Total orphaned selectors | 7 |
| Files with orphans | 3 |
| Overall unused rate | 8% |

## `src/components/Button/Button.module.css`
| Defined | Orphaned | Unused % |
| --- | --- | --- |
| 6 | 2 | 33% |

**Orphaned selectors:**
- `.iconLeft`
- `.loadingSpinner`
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
