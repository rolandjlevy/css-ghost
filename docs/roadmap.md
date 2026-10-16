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

## Other Planned Improvements

- **`--watch` mode** — re-run the scan automatically when style or component files change
- **Ignore patterns** — a `.cssghostignore` file (or `cssGhost.ignore` in `package.json`) to exclude specific selectors or files
- **JSON output** — `--format json` for piping results into other tools or CI pipelines
- **GitHub Actions example** — a sample workflow that runs `css-ghost` on PRs and comments with the orphan count
- **Monorepo support** — smarter cross-package usage detection when a style file in one package is consumed in another
