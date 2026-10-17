---
title: "css-ghost: find and delete orphaned CSS selectors with zero config"
published: false
description: "A zero-config Node.js CLI that cross-references your style files against your components and flags every selector nobody is using — with line numbers, the actual CSS, and an optional auto-delete."
tags: css, node, tooling, webdev
cover_image:
---

You've been there. You rename a component, move a file, or quietly migrate from one styling approach to another — and the old CSS stays behind. Nobody complains, the build doesn't break, and the dead selectors quietly accumulate.

[css-ghost](https://www.npmjs.com/package/@rolandjlevy/css-ghost) is a small Node.js CLI I built to solve exactly that. Point it at a folder and it tells you every CSS class defined in your style files that isn't referenced anywhere in your components.

![css-ghost terminal demo](./demo.gif)

---

## What it does

css-ghost scans your style files (`.css`, `.module.css`, `.scss`, `.sass`, `.less`, MUI `makeStyles`, vanilla-extract), extracts every class selector, then cross-references them against every component file it can find (`.js`, `.jsx`, `.ts`, `.tsx`, `.vue`, `.svelte`).

Anything defined but never used gets reported as an orphan — with its line number and the full CSS rule printed inline, so you can see what it does before deciding to delete it.

It also catches **orphaned CSS custom properties** (`--my-token: value` defined but never consumed via `var(--my-token)` anywhere in the codebase), reported in a separate 🔮 section.

---

## Run it now

No install required:

```bash
npx @rolandjlevy/css-ghost ./src
```

Or install globally for repeated use:

```bash
npm install -g @rolandjlevy/css-ghost
css-ghost ./src
```

---

## Dynamic class detection

If a component accesses classes dynamically — `styles[variable]`, `styles[\`${variant}\`]` — css-ghost can't resolve the class name statically. Rather than silently skip those files or report false positives, it flags them with a ⚠️ warning per file:

```
✅ src/components/Alert/Alert.module.css

   ⚠️  Dynamic class references detected — results may be incomplete.
   Dynamic references in: src/components/Alert.jsx

   👻 .hidden (line 30)
      .hidden { display: none; }
```

All statically resolvable patterns are still analysed: string literals, ternaries, `cx({ active: isOn })` object keys, array literals, and both branches of ternaries.

---

## Deleting orphans

Once you're happy with the report, pass `--delete` to remove every flagged selector from its source file:

```bash
css-ghost ./src --delete
```

css-ghost prints the full report first, lists what it's about to delete, then asks for confirmation. Pass `--yes` to skip the prompt in CI:

```bash
css-ghost ./src --delete --yes
```

> Tip: commit or stash first. There's no undo.

---

## Other useful flags

| Flag | What it does |
|---|---|
| `--ghost-trail` | Show the last git commit that touched each orphan |
| `--strict` | Exit with code 1 when orphans exist (CI / pre-commit) |
| `--install-hook ./src` | Write a pre-commit hook that blocks commits with orphans |
| `--output <path>` | Custom path for the markdown report |
| `--ai` | Append a plain-English AI summary (needs free OpenRouter key) |

---

## Ghost trail

Pass `--ghost-trail` to fetch the last git commit that changed each orphan's occurrence count:

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

Handy for tracking down when and why a class went dead.

---

## Pre-commit hook

```bash
css-ghost --install-hook ./src
```

Writes `.git/hooks/pre-commit` (executable, `chmod 755`) that blocks commits whenever orphaned selectors exist. Remove it with `rm .git/hooks/pre-commit`.

---

## How is it different from PurgeCSS?

[PurgeCSS](https://www.npmjs.com/package/purgecss) is a **build-time bundler** — it hooks into webpack or PostCSS to strip unused CSS from your *production output*. It's designed for frameworks like Tailwind or Bootstrap where you use a fraction of the utility classes.

css-ghost is a **source code auditor** — it finds dead selectors in your *actual codebase*, with no build step and no config file.

| | PurgeCSS | css-ghost |
|---|---|---|
| Works on source files | ❌ Build output only | ✅ |
| Zero config, no build step | ❌ | ✅ |
| CSS custom property orphans | ❌ | ✅ |
| Git history per orphan | ❌ | ✅ |
| Pre-commit hook | ❌ | ✅ |
| Deletes dead code for you | ❌ | ✅ |
| Safe with dynamic classes | ❌ Silently removes them | ✅ Flags with ⚠️ |

The two tools are complementary — PurgeCSS for trimming framework output at build time, css-ghost for auditing your own hand-written CSS throughout development.

---

The source is on [GitHub](https://github.com/rolandjlevy/css-ghost) and the package is on [npm](https://www.npmjs.com/package/@rolandjlevy/css-ghost). PRs and issues welcome.
