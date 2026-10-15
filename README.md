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

## License

MIT
