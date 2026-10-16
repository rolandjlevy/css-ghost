# css-ghost VS Code extension: build and handover guide

> **Intended location:** `docs/vscode-extension.md` in <https://github.com/rolandjlevy/css-ghost>
> **Written:** 16 October 2026
> **Status:** v0.1.0 scaffold. It builds, typechecks, packages to a `.vsix`, and passes the tests described in section 8. It has **not yet been run in a real VS Code window**, only against a stubbed VS Code API. First manual F5 run is the next step.
> **Originating Claude Code session** (full conversation, plus the two delivered files `css-ghost-vscode.zip` and `css-ghost-0.1.0.vsix`): <https://claude.ai/code/session_019BY5HrQAPx5us3xptNu3h9>

This document is a self-contained handover. Every source file of the extension is reproduced in full in section 7, so an engineer or an AI coding tool can recreate the project from this file alone, without the zip.

---

## Table of contents

1. [Goal and requirements](#1-goal-and-requirements)
2. [What the css-ghost core exposes](#2-what-the-css-ghost-core-exposes)
3. [Architecture and design decisions](#3-architecture-and-design-decisions)
4. [Project layout](#4-project-layout)
5. [Recreate from scratch](#5-recreate-from-scratch)
6. [Run it locally](#6-run-it-locally)
7. [Full source listings](#7-full-source-listings)
8. [Testing](#8-testing)
9. [Publishing](#9-publishing)
10. [Known limitations and suggested follow-ups](#10-known-limitations-and-suggested-follow-ups)
11. [Problems hit while building, and fixes](#11-problems-hit-while-building-and-fixes)
12. [Where the extension code should live in the repo](#12-where-the-extension-code-should-live-in-the-repo)
13. [Brief to paste into an AI coding tool](#13-brief-to-paste-into-an-ai-coding-tool)
14. [Links](#14-links)

---

## 1. Goal and requirements

Build a VS Code extension with the same name and branding as the `css-ghost` CLI (`@rolandjlevy/css-ghost` on npm), reusing the existing parser and scanner rather than reimplementing them.

Requested features, and how each is delivered:

| Requirement | Implementation |
| --- | --- |
| Highlight orphaned selectors inline in CSS files (squiggle or gutter icon) | `vscode.Diagnostic` warning with `DiagnosticTag.Unnecessary` (squiggle plus fade) and a gutter decoration using `media/ghost-gutter.svg` |
| Hover tooltip: "This selector appears to be unused" | `registerHoverProvider` for CSS/SCSS/Sass/Less and JS/TS files; shows the message plus the rule text |
| Entries in the Problems panel | Same diagnostics, source `css-ghost`, code = selector name |
| `css-ghost: Scan workspace` command | Command `css-ghost.scanWorkspace` (title "Scan workspace", category "css-ghost"), shows a summary toast |
| Auto-scan on file save | `onDidSaveTextDocument`, debounced 400 ms, for `.css .scss .sass .less .js .jsx .ts .tsx` |

Extras added beyond the brief: a status-bar item (`👻 <count>`, click opens Problems), a `css-ghost: Clear results` command, four settings (`scanOnSave`, `scanOnStartup`, `paths`, `showGutterIcons`), an output channel, and a scan on activation.

---

## 2. What the css-ghost core exposes

Read from the repo at <https://github.com/rolandjlevy/css-ghost> (package version **1.0.4**, `"type": "module"`, Node `>=18`).

Files in `src/`: `parser.js`, `scanner.js`, `walker.js`, `reporter.js`, `ai.js`, `setup.js`. Only `scanner.js` (which imports `walker.js` and `parser.js`) is needed by the extension. `reporter.js`, `ai.js` and `setup.js` are CLI-only (markdown report, OpenRouter summary, key setup).

### `scan(dirs: string[])` in `src/scanner.js`

Synchronous. Uses `readdirSync` / `readFileSync` throughout. Returns one entry per style file:

```ts
interface CoreScanResult {
  filePath: string;
  total: number;                                   // selectors defined in the file
  orphaned: { name: string; line: number; rule: string }[]; // line is 1-based
  hasDynamic: boolean;                             // true if ANY component file is dynamic (see section 10)
  dynamicFiles: string[];                          // component files with styles[var] or `${}` templates
}
```

Behaviour worth knowing:

- **Walker** (`walker.js`): style extensions `.css .scss .sass .less`; component extensions `.js .jsx .ts .tsx`; skips dot-folders and `node_modules`, `.git`, `dist`, `build`, `.next`, `out`, `coverage`, `.cache`.
- **JS/TS style files:** a `.js` or `.ts` file is treated as a style file (not a component) if it contains `StyleSheet.create({` or is named `style(s).js|ts` with `const styles = {`.
- **Usage detection** (`extractUsages` in `parser.js`): `className="..."`, `styles.foo`, `styles['foo']`, ternary bracket `styles[cond ? 'a' : 'b']`, and `cx` / `clsx` / `classnames` with string, object-key and array-string arguments. Truly dynamic patterns set `hasDynamic`.
- **Usage is global:** all used names from every component file go into one `Set`. A selector counts as used if any file anywhere uses that name.
- **Selector extraction:** first occurrence of each class name per file wins (`if (!selectors.has(name))`).

The extension calls `scan()` directly via the deep import `@rolandjlevy/css-ghost/src/scanner.js`. That works only because the core's `package.json` has **no `"exports"` field**. If an `"exports"` map is ever added to the CLI package, the deep import breaks, so either expose `./src/scanner.js` there or add a proper programmatic entry point (suggested in section 10).

The CLI's own fixtures (`test/components`, `test/styles`) were copied into `test/fixtures/` and drive the tests. Expected orphans there: `Button.module.css` has `disabled` and `iconRight`; `demo.module.css` has `ghost` and `phantom`.

---

## 3. Architecture and design decisions

```
┌───────────────────────── VS Code extension host ─────────────────────────┐
│ extension.ts                                                              │
│  • activate(): output channel, DiagnosticCollection, decoration type,     │
│    status bar, hover provider, commands, save/config listeners            │
│  • requestScan() → debounce → runScan() (one scan at a time, re-run flag) │
│  • applyResults(): Diagnostics + gutter decorations + status + hover state│
│        ▲                                                                  │
│        │ ScanOutput (postMessage)                                         │
│  scanClient.ts ── spawns ──►  dist/worker.js  (worker_thread)             │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │ worker.ts
                                     ▼
              @rolandjlevy/css-ghost  scan(dirs)   (unchanged core)
                                     + locate.ts (adds column ranges)
```

Key decisions:

1. **Reuse the core as an npm dependency**, not a copy. Fixes to the parser flow into the extension by bumping the dependency. Deep import of `src/scanner.js`.
2. **Run the scan in a `worker_thread`.** The core is fully synchronous, and running it on the extension host thread would freeze the editor on large workspaces. The worker is a separate esbuild entry point (`dist/worker.js`). Cancellation is `worker.terminate()`.
3. **Bundle with esbuild to CommonJS.** The core is ESM; the extension host wants CJS. esbuild bundles our TypeScript and the core into `dist/extension.js` (about 6 KB minified) and `dist/worker.js` (about 5 KB). `vscode` is external. Nothing from `node_modules` ships in the `.vsix`.
4. **Columns are computed by the extension.** The core reports only 1-based line numbers. `locate.ts` finds the selector on its line with a regex (`\.name(?![\w-])` for CSS, key-aware patterns for JS style objects) so the squiggle covers `.foo` only. Fallback is the trimmed line.
5. **Diagnostics as the primary surface.** One `Diagnostic` per orphan (severity Warning, source `css-ghost`, code = name, tag `Unnecessary` for the faded "ghost" look). This gives the squiggle, the Problems panel and the overview ruler for free.
6. **Scan scheduling.** `requestScan()` debounces (400 ms on save). If a scan is running, a flag coalesces further requests into exactly one re-run afterwards. Scans on save are workspace-wide because usage is global; a change in a component file can orphan or revive selectors in any style file.
7. **Dynamic-pattern caveat is surfaced, not hidden.** If `dynamicFiles` is non-empty, hover text and the status-bar tooltip say results may include false positives.
8. **Activation:** `workspaceContains:**/*.{css,scss,sass,less}` plus the `scanOnStartup` setting. `virtualWorkspaces: false`; untrusted workspaces are supported (the extension only reads files).
9. **Only `file:` URIs are handled.** Remote/virtual file systems are out of scope for v0.1.

---

## 4. Project layout

```
css-ghost-vscode/
├── package.json            manifest: commands, settings, activation, scripts, deps
├── tsconfig.json           typecheck only (esbuild does the emit)
├── esbuild.mjs             builds dist/extension.js and dist/worker.js
├── .vscodeignore           keeps the .vsix tiny (dist + media + manifest only)
├── .gitignore
├── LICENSE                 MIT, © 2026 Roland Levy
├── CHANGELOG.md
├── README.md               Marketplace page content
├── media/
│   ├── icon.png            128×128 Marketplace icon (generated; script in section 7)
│   └── ghost-gutter.svg    gutter icon
├── src/
│   ├── extension.ts        activation, UI wiring, scheduling
│   ├── scanClient.ts       spawns the worker, returns a cancellable promise
│   ├── worker.ts           runs core scan(), adds columns, truncates rule previews
│   ├── locate.ts           pure selector → column-range helper
│   ├── types.ts            shared types
│   └── core.d.ts           type declarations for the untyped JS core
├── test/
│   ├── worker.test.mjs     node:test suite against dist/worker.js
│   └── fixtures/           copy of the CLI's test/components and test/styles
└── .vscode/
    ├── launch.json         F5 "Run Extension" config (opens test/fixtures)
    └── tasks.json          background esbuild watch task
```

---

## 5. Recreate from scratch

Requires Node 18+ (built and tested on Node 22.22.0, npm 10.9.4).

```bash
mkdir css-ghost-vscode && cd css-ghost-vscode
mkdir -p src media test/fixtures .vscode

# 1. Copy the CLI fixtures
git clone --depth 1 https://github.com/rolandjlevy/css-ghost.git /tmp/css-ghost-src
cp -r /tmp/css-ghost-src/test/components /tmp/css-ghost-src/test/styles test/fixtures/

# 2. Create every file from section 7 (package.json first)

# 3. Install
npm install @rolandjlevy/css-ghost
npm install --save-dev typescript esbuild "@types/node@^20" @vscode/vsce
npm install --save-dev --save-exact @types/vscode@1.85.0   # must NOT exceed engines.vscode, see section 11

# 4. Generate the icon (needs Python 3 with Pillow)
python3 make_icon.py media/icon.png

# 5. Verify
npm run typecheck
npm test
```

Versions that resolved on 16 Oct 2026 (the `package.json` in section 7 records the exact ranges): `@rolandjlevy/css-ghost ^1.0.4`, `typescript ^7.0.2`, `esbuild ^0.28.2`, `@vscode/vsce ^4.0.0`, `@types/node ^20.19.43`, `@types/vscode 1.85.0` (pinned).

---

## 6. Run it locally

1. `npm install && npm test`.
2. Open the folder in VS Code and press **F5** ("Run Extension"). `tasks.json` starts `esbuild --watch`; `launch.json` opens a second window on `test/fixtures`.
3. In the new window open `styles/demo.module.css`. Expected: `.ghost` and `.phantom` squiggled and faded, ghost icon in the gutter, `👻 4` in the status bar (4 orphans across 2 files), 4 entries under **Problems → css-ghost**.
4. Hover `.ghost` to see "This selector appears to be unused" plus the rule.
5. Command Palette → **css-ghost: Scan workspace** shows "css-ghost: 4 unused selectors in 2 files."
6. Edit `components/Demo.jsx` to use `styles.ghost`, save, and `.ghost` should clear after about half a second.

Install the packaged build into your normal VS Code:

```bash
npm run package                       # builds and writes css-ghost-0.1.0.vsix
code --install-extension css-ghost-0.1.0.vsix
```

Point it at a real project with a `settings.json` entry such as `"css-ghost.paths": ["src"]`.

---

## 7. Full source listings

These are the exact files used for the tested v0.1.0 build.

### `package.json`

````json
{
  "name": "css-ghost",
  "displayName": "css-ghost",
  "description": "Find orphaned CSS class selectors — defined in style files but never referenced in your components.",
  "version": "0.1.0",
  "publisher": "rolandjlevy",
  "author": "Roland Levy",
  "license": "MIT",
  "homepage": "https://github.com/rolandjlevy/css-ghost#readme",
  "icon": "media/icon.png",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": [
    "Linters",
    "Programming Languages"
  ],
  "keywords": [
    "css",
    "scss",
    "orphan",
    "unused",
    "selectors",
    "react",
    "css modules",
    "dead code"
  ],
  "main": "./dist/extension.js",
  "activationEvents": [
    "workspaceContains:**/*.{css,scss,sass,less}"
  ],
  "capabilities": {
    "virtualWorkspaces": false,
    "untrustedWorkspaces": {
      "supported": true
    }
  },
  "contributes": {
    "commands": [
      {
        "command": "css-ghost.scanWorkspace",
        "title": "Scan workspace",
        "category": "css-ghost"
      },
      {
        "command": "css-ghost.clearResults",
        "title": "Clear results",
        "category": "css-ghost"
      }
    ],
    "configuration": {
      "title": "css-ghost",
      "properties": {
        "css-ghost.scanOnSave": {
          "type": "boolean",
          "default": true,
          "description": "Re-scan the workspace whenever a style or component file is saved."
        },
        "css-ghost.scanOnStartup": {
          "type": "boolean",
          "default": true,
          "description": "Scan the workspace when the extension activates."
        },
        "css-ghost.paths": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "default": [
            "."
          ],
          "description": "Directories to scan, relative to each workspace folder (e.g. [\"src\"]). node_modules, dist, build, .next and dot-folders are always skipped."
        },
        "css-ghost.showGutterIcons": {
          "type": "boolean",
          "default": true,
          "description": "Show a ghost icon in the gutter next to orphaned selectors."
        }
      }
    }
  },
  "scripts": {
    "build": "node esbuild.mjs",
    "watch": "node esbuild.mjs --watch",
    "typecheck": "tsc --noEmit",
    "test": "npm run build && node --test test/worker.test.mjs",
    "vscode:prepublish": "npm run typecheck && node esbuild.mjs --production",
    "package": "vsce package"
  },
  "dependencies": {
    "@rolandjlevy/css-ghost": "^1.0.4"
  },
  "devDependencies": {
    "@types/node": "^20.19.43",
    "@types/vscode": "1.85.0",
    "@vscode/vsce": "^4.0.0",
    "esbuild": "^0.28.2",
    "typescript": "^7.0.2"
  }
}
````

### `tsconfig.json`

````json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node", "vscode"]
  },
  "include": ["src"]
}
````

### `esbuild.mjs`

````js
import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// The css-ghost core is plain ESM; esbuild bundles it (and our TS) into CommonJS
// for the extension host, and into a standalone worker script.
const options = {
  entryPoints: {
    extension: 'src/extension.ts',
    worker: 'src/worker.ts',
  },
  outdir: 'dist',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  external: ['vscode'],
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[css-ghost] watching…');
} else {
  await esbuild.build(options);
}
````

### `src/types.ts`

````ts
/** Shapes shared between the worker thread and the extension host. */

export interface OrphanItem {
  /** Selector name without the leading dot (or the key name for JS style files). */
  name: string;
  /** 1-based line number, as reported by the css-ghost parser. */
  line: number;
  /** 0-based start column of the selector on that line. */
  startCol: number;
  /** 0-based end column (exclusive). */
  endCol: number;
  /** Full rule text (truncated) for the hover preview. */
  rule: string;
}

export interface FileResult {
  filePath: string;
  /** Total selectors defined in the file. */
  total: number;
  orphans: OrphanItem[];
}

export interface ScanOutput {
  files: FileResult[];
  /** Component files containing dynamic class patterns (`styles[variable]`, `${}` templates). */
  dynamicFiles: string[];
  scannedDirs: string[];
  durationMs: number;
}

export interface WorkerRequest {
  dirs: string[];
}

export type WorkerResponse =
  | { ok: true; output: ScanOutput }
  | { ok: false; error: string };
````

### `src/core.d.ts`

````ts
// Type declarations for the (untyped, plain-JS) css-ghost core package.
// The extension deep-imports src/scanner.js so it reuses the exact CLI logic.

declare module '@rolandjlevy/css-ghost/src/scanner.js' {
  export interface CoreOrphan {
    name: string;
    /** 1-based line number. */
    line: number;
    rule: string;
  }

  export interface CoreScanResult {
    filePath: string;
    total: number;
    orphaned: CoreOrphan[];
    hasDynamic: boolean;
    dynamicFiles: string[];
  }

  export function scan(dirs: string[]): CoreScanResult[];
}
````

### `src/locate.ts`

````ts
/**
 * The css-ghost core reports line numbers but not columns. This finds the exact
 * range of a selector on its line so the squiggle covers `.foo`, not the whole line.
 * Pure function — no VS Code or fs dependency, so it is easy to test.
 */

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type StyleKind = 'css' | 'js';

export function styleKindFor(filePath: string): StyleKind {
  return /\.(css|scss|sass|less)$/i.test(filePath) ? 'css' : 'js';
}

/** Returns [startCol, endCol) for `name` on `lineText`. Falls back to the trimmed line. */
export function locate(lineText: string, name: string, kind: StyleKind): [number, number] {
  const esc = escapeRegExp(name);

  const patterns =
    kind === 'css'
      ? // `.foo` not followed by more identifier characters (so `.foo` != `.foo-bar`)
        [new RegExp(`\\.${esc}(?![\\w-])`)]
      : // JS style object key: `foo:` first, then any bare occurrence
        [
          new RegExp(`(?<![\\w$.])${esc}(?![\\w$])(?=\\s*:)`),
          new RegExp(`(?<![\\w$])${esc}(?![\\w$])`),
        ];

  for (const re of patterns) {
    const m = re.exec(lineText);
    if (m) return [m.index, m.index + m[0].length];
  }

  const start = Math.max(lineText.search(/\S/), 0);
  return [start, Math.max(lineText.replace(/\s+$/, '').length, start)];
}
````

### `src/worker.ts`

````ts
/**
 * Runs the css-ghost core scan off the extension host thread.
 *
 * The core uses synchronous fs calls (readdirSync/readFileSync), which would freeze the
 * extension host on large workspaces — so it lives in a worker_thread instead.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { scan } from '@rolandjlevy/css-ghost/src/scanner.js';
import { locate, styleKindFor } from './locate';
import type { FileResult, ScanOutput, WorkerRequest, WorkerResponse } from './types';

const MAX_RULE_LINES = 12;

function truncateRule(rule: string): string {
  const lines = rule.split('\n');
  if (lines.length <= MAX_RULE_LINES) return rule;
  return [...lines.slice(0, MAX_RULE_LINES), '  /* … */'].join('\n');
}

function run({ dirs }: WorkerRequest): ScanOutput {
  const started = Date.now();
  const results = scan(dirs);

  const dynamicFiles = new Set<string>();
  const byPath = new Map<string, FileResult>(); // de-dupe if scan paths overlap

  for (const r of results) {
    for (const f of r.dynamicFiles) dynamicFiles.add(f);
    if (byPath.has(r.filePath)) continue;

    let lines: string[] = [];
    if (r.orphaned.length > 0) {
      try {
        lines = readFileSync(r.filePath, 'utf-8').split(/\r?\n/);
      } catch {
        // file vanished between scan and read — fall back to whole-line ranges
      }
    }

    const kind = styleKindFor(r.filePath);
    byPath.set(r.filePath, {
      filePath: r.filePath,
      total: r.total,
      orphans: r.orphaned.map((o) => {
        const [startCol, endCol] = locate(lines[o.line - 1] ?? '', o.name, kind);
        return { name: o.name, line: o.line, startCol, endCol, rule: truncateRule(o.rule) };
      }),
    });
  }

  return {
    files: [...byPath.values()],
    dynamicFiles: [...dynamicFiles],
    scannedDirs: dirs,
    durationMs: Date.now() - started,
  };
}

let response: WorkerResponse;
try {
  response = { ok: true, output: run(workerData as WorkerRequest) };
} catch (e) {
  response = { ok: false, error: e instanceof Error ? e.message : String(e) };
}
parentPort?.postMessage(response);
````

### `src/scanClient.ts`

````ts
import { Worker } from 'node:worker_threads';
import * as path from 'node:path';
import type { ScanOutput, WorkerRequest, WorkerResponse } from './types';

export interface ScanHandle {
  result: Promise<ScanOutput>;
  cancel(): void;
}

/** Starts a scan in a worker thread. Resolves with the scan output; rejects on failure or cancel. */
export function startScan(dirs: string[], extensionPath: string): ScanHandle {
  const worker = new Worker(path.join(extensionPath, 'dist', 'worker.js'), {
    workerData: { dirs } satisfies WorkerRequest,
  });

  let settled = false;
  let cancelled = false;

  const result = new Promise<ScanOutput>((resolve, reject) => {
    worker.once('message', (msg: WorkerResponse) => {
      settled = true;
      if (msg.ok) resolve(msg.output);
      else reject(new Error(msg.error));
      void worker.terminate();
    });
    worker.once('error', (err) => {
      settled = true;
      reject(err);
    });
    worker.once('exit', (code) => {
      if (settled) return;
      settled = true;
      reject(new Error(cancelled ? 'cancelled' : `scan worker exited unexpectedly (code ${code})`));
    });
  });

  return {
    result,
    cancel() {
      cancelled = true;
      void worker.terminate();
    },
  };
}
````

### `src/extension.ts`

````ts
import * as vscode from 'vscode';
import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { startScan, type ScanHandle } from './scanClient';
import { styleKindFor } from './locate';
import type { FileResult, OrphanItem, ScanOutput } from './types';

const SOURCE = 'css-ghost';
const SAVE_DEBOUNCE_MS = 400;
const RELEVANT_FILE = /\.(css|scss|sass|less|jsx?|tsx?)$/i;

/** Languages the hover provider covers: style files plus JS/TS style objects. */
const HOVER_SELECTOR: vscode.DocumentSelector = [
  'css',
  'scss',
  'sass',
  'less',
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
].map((language) => ({ scheme: 'file', language }));

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('css-ghost');
  const diagnostics = vscode.languages.createDiagnosticCollection(SOURCE);

  const gutterDecoration = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.joinPath(context.extensionUri, 'media', 'ghost-gutter.svg'),
    gutterIconSize: 'contain',
    overviewRulerColor: new vscode.ThemeColor('editorWarning.foreground'),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  });

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  status.command = 'workbench.actions.view.problems';

  /** Latest results keyed by document URI string. */
  let state = new Map<string, FileResult>();
  let lastOutput: ScanOutput | undefined;

  // ── Scan scheduling ───────────────────────────────────────────────────────
  let timer: NodeJS.Timeout | undefined;
  let running: ScanHandle | undefined;
  let rerunRequested = false;
  let notifyWhenDone = false;
  let disposed = false;

  const config = () => vscode.workspace.getConfiguration('css-ghost');

  function resolveScanDirs(): string[] {
    const folders = (vscode.workspace.workspaceFolders ?? []).filter((f) => f.uri.scheme === 'file');
    const relPaths = config().get<string[]>('paths', ['.']);
    const dirs = new Set<string>();
    for (const folder of folders) {
      for (const rel of relPaths) {
        const abs = path.resolve(folder.uri.fsPath, rel);
        if (existsSync(abs)) dirs.add(abs);
      }
    }
    return [...dirs];
  }

  function requestScan(opts: { delay?: number; notify?: boolean } = {}): void {
    if (opts.notify) notifyWhenDone = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void runScan(), opts.delay ?? 0);
  }

  async function runScan(): Promise<void> {
    if (disposed) return;
    if (running) {
      rerunRequested = true; // coalesce: run once more after the current scan finishes
      return;
    }

    const dirs = resolveScanDirs();
    if (dirs.length === 0) {
      setStatus('idle');
      if (notifyWhenDone) {
        notifyWhenDone = false;
        void vscode.window.showInformationMessage('css-ghost: open a folder to scan.');
      }
      return;
    }

    setStatus('scanning');
    const handle = startScan(dirs, context.extensionPath);
    running = handle;

    try {
      const out = await handle.result;
      if (disposed) return;
      applyResults(out);
      output.appendLine(
        `[${new Date().toLocaleTimeString()}] scanned ${dirs.join(', ')} in ${out.durationMs}ms — ` +
          `${countOrphans(out)} orphan(s) in ${out.files.filter((f) => f.orphans.length).length} file(s)`,
      );
      if (notifyWhenDone) void notifySummary(out);
    } catch (err) {
      if (disposed) return;
      const message = err instanceof Error ? err.message : String(err);
      output.appendLine(`[${new Date().toLocaleTimeString()}] scan failed: ${message}`);
      setStatus('error', message);
    } finally {
      notifyWhenDone = false;
      running = undefined;
      if (rerunRequested && !disposed) {
        rerunRequested = false;
        requestScan();
      }
    }
  }

  // ── Presentation ──────────────────────────────────────────────────────────
  const countOrphans = (out: ScanOutput): number =>
    out.files.reduce((n, f) => n + f.orphans.length, 0);

  const toRange = (o: OrphanItem): vscode.Range =>
    new vscode.Range(o.line - 1, o.startCol, o.line - 1, o.endCol);

  const displayName = (filePath: string, o: OrphanItem): string =>
    styleKindFor(filePath) === 'css' ? `.${o.name}` : o.name;

  function applyResults(out: ScanOutput): void {
    lastOutput = out;
    state = new Map();
    diagnostics.clear();

    for (const file of out.files) {
      if (file.orphans.length === 0) continue;
      const uri = vscode.Uri.file(file.filePath);
      state.set(uri.toString(), file);

      diagnostics.set(
        uri,
        file.orphans.map((o) => {
          const d = new vscode.Diagnostic(
            toRange(o),
            `${displayName(file.filePath, o)} appears to be unused`,
            vscode.DiagnosticSeverity.Warning,
          );
          d.source = SOURCE;
          d.code = o.name;
          d.tags = [vscode.DiagnosticTag.Unnecessary]; // fades the selector — the "ghost" effect
          return d;
        }),
      );
    }

    vscode.window.visibleTextEditors.forEach(refreshEditor);
    setStatus('done');
  }

  function clearResults(): void {
    state = new Map();
    lastOutput = undefined;
    diagnostics.clear();
    vscode.window.visibleTextEditors.forEach(refreshEditor);
    setStatus('idle');
  }

  function refreshEditor(editor: vscode.TextEditor): void {
    const file = state.get(editor.document.uri.toString());
    const show = config().get<boolean>('showGutterIcons', true);
    editor.setDecorations(gutterDecoration, show && file ? file.orphans.map(toRange) : []);
  }

  function setStatus(kind: 'idle' | 'scanning' | 'done' | 'error', detail?: string): void {
    switch (kind) {
      case 'scanning':
        status.text = '$(sync~spin) css-ghost';
        status.tooltip = 'css-ghost: scanning…';
        break;
      case 'error':
        status.text = '$(error) css-ghost';
        status.tooltip = `css-ghost: scan failed${detail ? ` — ${detail}` : ''}`;
        break;
      case 'done': {
        const total = lastOutput ? countOrphans(lastOutput) : 0;
        status.text = `👻 ${total}`;
        const tip = new vscode.MarkdownString(
          total === 0
            ? '**css-ghost** — no unused selectors found.'
            : `**css-ghost** — ${total} unused selector${total === 1 ? '' : 's'}. Click to open Problems.`,
        );
        if (lastOutput?.dynamicFiles.length) {
          tip.appendMarkdown(
            `\n\n⚠️ ${lastOutput.dynamicFiles.length} component file(s) build class names dynamically, ` +
              'so some results may be false positives.',
          );
        }
        status.tooltip = tip;
        break;
      }
      default:
        status.text = '👻 css-ghost';
        status.tooltip = 'css-ghost: run "css-ghost: Scan workspace"';
    }
    status.show();
  }

  async function notifySummary(out: ScanOutput): Promise<void> {
    const total = countOrphans(out);
    const files = out.files.filter((f) => f.orphans.length).length;
    const text =
      total === 0
        ? 'css-ghost: no unused selectors found. 👻'
        : `css-ghost: ${total} unused selector${total === 1 ? '' : 's'} in ${files} file${files === 1 ? '' : 's'}.`;
    const choice = await vscode.window.showInformationMessage(text, ...(total ? ['Open Problems'] : []));
    if (choice === 'Open Problems') void vscode.commands.executeCommand('workbench.actions.view.problems');
  }

  // ── Hover ─────────────────────────────────────────────────────────────────
  const hover = vscode.languages.registerHoverProvider(HOVER_SELECTOR, {
    provideHover(document, position) {
      const file = state.get(document.uri.toString());
      if (!file) return undefined;

      const orphan = file.orphans.find((o) => toRange(o).contains(position));
      if (!orphan) return undefined;

      const md = new vscode.MarkdownString();
      md.appendMarkdown('👻 **This selector appears to be unused**\n\n');
      md.appendCodeblock(orphan.rule, document.languageId);
      if (lastOutput?.dynamicFiles.length) {
        md.appendMarkdown(
          `_${lastOutput.dynamicFiles.length} component file(s) use dynamic class names, so this may be a false positive._`,
        );
      }
      return new vscode.Hover(md, toRange(orphan));
    },
  });

  // ── Wiring ────────────────────────────────────────────────────────────────
  context.subscriptions.push(
    output,
    diagnostics,
    gutterDecoration,
    status,
    hover,

    vscode.commands.registerCommand('css-ghost.scanWorkspace', () => requestScan({ notify: true })),
    vscode.commands.registerCommand('css-ghost.clearResults', clearResults),

    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (!config().get<boolean>('scanOnSave', true)) return;
      if (doc.uri.scheme !== 'file' || !RELEVANT_FILE.test(doc.fileName)) return;
      if (doc.fileName.includes(`${path.sep}node_modules${path.sep}`)) return;
      if (!vscode.workspace.getWorkspaceFolder(doc.uri)) return;
      requestScan({ delay: SAVE_DEBOUNCE_MS });
    }),

    vscode.window.onDidChangeVisibleTextEditors((editors) => editors.forEach(refreshEditor)),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('css-ghost.showGutterIcons')) {
        vscode.window.visibleTextEditors.forEach(refreshEditor);
      }
      if (e.affectsConfiguration('css-ghost.paths') && lastOutput) requestScan();
    }),

    { dispose: () => { disposed = true; if (timer) clearTimeout(timer); running?.cancel(); } },
  );

  setStatus('idle');
  if (config().get<boolean>('scanOnStartup', true)) requestScan();
}

export function deactivate(): void {
  // Everything is disposed through context.subscriptions.
}
````

### `test/worker.test.mjs`

````js
// End-to-end check of the bundled worker (dist/worker.js) against the css-ghost fixtures.
// Run with `npm test` (builds first). This exercises the real core scan, the adapter and
// the column-location logic — everything except the VS Code API surface itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workerPath = path.join(root, 'dist', 'worker.js');
const fixtures = path.join(root, 'test', 'fixtures');

function runWorker(dirs) {
  return new Promise((resolve, reject) => {
    const w = new Worker(workerPath, { workerData: { dirs } });
    w.once('message', (msg) => (msg.ok ? resolve(msg.output) : reject(new Error(msg.error))));
    w.once('error', reject);
  });
}

const orphansByFile = (out) =>
  Object.fromEntries(
    out.files.map((f) => [path.basename(f.filePath), f.orphans.map((o) => o.name).sort()]),
  );

test('finds the expected orphans in the fixtures', async () => {
  const out = await runWorker([fixtures]);
  assert.deepEqual(orphansByFile(out), {
    'Button.module.css': ['disabled', 'iconRight'],
    'demo.module.css': ['ghost', 'phantom'],
  });
  assert.deepEqual(out.dynamicFiles, []);
});

test('column ranges cover exactly the `.selector` text', async () => {
  const out = await runWorker([fixtures]);
  for (const file of out.files) {
    const lines = readFileSync(file.filePath, 'utf-8').split(/\r?\n/);
    for (const o of file.orphans) {
      const covered = lines[o.line - 1].slice(o.startCol, o.endCol);
      assert.equal(covered, `.${o.name}`, `${path.basename(file.filePath)}:${o.line}`);
      assert.ok(o.rule.includes(`.${o.name}`), 'rule preview includes the selector');
    }
  }
});

test('overlapping scan paths do not produce duplicate files', async () => {
  const out = await runWorker([fixtures, path.join(fixtures, 'styles')]);
  const paths = out.files.map((f) => f.filePath);
  assert.equal(new Set(paths).size, paths.length);
});

test('returns no results (and does not crash) for a missing directory', async () => {
  const out = await runWorker([path.join(fixtures, 'does-not-exist')]);
  assert.deepEqual(out.files, []);
});
````

### `media/ghost-gutter.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <!-- Neutral fill + dark outline so the ghost reads on both light and dark themes -->
  <path d="M12 2.5c-4.1 0-7 3-7 7.2V20.5c0 .6.7.9 1.1.5l1.9-1.8 2 1.8c.5.4 1.1.4 1.6 0l2-1.8 1.9 1.8c.4.4 1.1.1 1.1-.5V9.7c0-4.2-2.9-7.2-6.6-7.2Z"
        fill="#e8e8f0" stroke="#4b4b63" stroke-width="1.2" stroke-linejoin="round"/>
  <circle cx="9.3" cy="10.2" r="1.35" fill="#2a2a3d"/>
  <circle cx="14.7" cy="10.2" r="1.35" fill="#2a2a3d"/>
  <ellipse cx="12" cy="14" rx="1.4" ry="1.8" fill="#2a2a3d"/>
</svg>
````

### `.vscode/launch.json`

````json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "${workspaceFolder}/test/fixtures"
      ],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "preLaunchTask": "npm: watch"
    }
  ]
}
````

### `.vscode/tasks.json`

````json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "watch",
      "isBackground": true,
      "problemMatcher": {
        "owner": "esbuild",
        "pattern": { "regexp": "^$" },
        "background": {
          "activeOnStart": true,
          "beginsPattern": "^\\[css-ghost\\] watching",
          "endsPattern": "^\\[css-ghost\\] watching"
        }
      },
      "group": { "kind": "build", "isDefault": true }
    }
  ]
}
````

### `.vscodeignore`

````text
.vscode/**
src/**
test/**
node_modules/**
tsconfig.json
esbuild.mjs
**/*.map
**/*.ts
.gitignore
````

### `.gitignore`

````text
node_modules/
dist/
*.vsix
````

### `CHANGELOG.md`

````md
# Changelog

## 0.1.0

- Initial scaffold: inline diagnostics, hover tooltip, gutter icon, Problems panel entries,
  `css-ghost: Scan workspace` command, auto-scan on save.
- Reuses the scan logic from `@rolandjlevy/css-ghost` (runs in a worker thread).
````

### `README.md` (Marketplace page)

````md
# 👻 css-ghost for VS Code

Find orphaned CSS class selectors — defined in your style files but never referenced in your components — without leaving the editor.

Powered by the same scan logic as the [`@rolandjlevy/css-ghost`](https://www.npmjs.com/package/@rolandjlevy/css-ghost) CLI.

## Features

- **Inline highlighting** — orphaned selectors get a squiggle, are faded out, and get a ghost icon in the gutter.
- **Hover tooltip** — "This selector appears to be unused", with a preview of the rule.
- **Problems panel** — every orphan is listed under `css-ghost`.
- **`css-ghost: Scan workspace`** — run a scan from the Command Palette.
- **Auto-scan on save** — saving a style or component file re-scans the workspace.

Supports `.css`, `.module.css`, `.scss`, `.sass`, `.less`, and JS/TS style objects (`StyleSheet.create({})`, `const styles = {}`).

Recognised usage patterns: `className="foo"`, `styles.foo`, `styles['foo']`, `styles[cond ? 'a' : 'b']`, and `cx` / `clsx` / `classnames` with strings, objects and arrays. Truly dynamic patterns (`styles[variable]`, template literals) can't be resolved statically — when they're present, hover text and the status bar warn that results may include false positives.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `css-ghost.scanOnSave` | `true` | Re-scan when a style or component file is saved. |
| `css-ghost.scanOnStartup` | `true` | Scan when the extension activates. |
| `css-ghost.paths` | `["."]` | Directories to scan, relative to each workspace folder (e.g. `["src"]`). |
| `css-ghost.showGutterIcons` | `true` | Show the ghost icon in the gutter. |

`node_modules`, `dist`, `build`, `.next`, `out`, `coverage` and dot-folders are always skipped.

## Development

```bash
npm install
npm test          # builds, then runs the worker against test/fixtures
```

Press **F5** in VS Code to launch an Extension Development Host with `test/fixtures` open.

```bash
npm run package   # produces a .vsix
```

### How it fits together

| File | Role |
| --- | --- |
| `src/extension.ts` | Activation, commands, diagnostics, hover, gutter decorations, status bar, save/debounce scheduling |
| `src/worker.ts` | Runs the css-ghost core `scan()` in a worker thread (the core uses synchronous fs calls) and adds column ranges |
| `src/scanClient.ts` | Spawns the worker and returns a promise |
| `src/locate.ts` | Finds the exact column range of a selector on its line (the core only reports line numbers) |

## License

MIT
````

### `LICENSE`

MIT, `Copyright (c) 2026 Roland Levy`. Use the standard MIT text (<https://opensource.org/license/mit>).

### `make_icon.py` (generates `media/icon.png`)

Not part of the project tree; run once. Needs Pillow. Output is a 128×128 RGBA PNG: white ghost on an indigo rounded square. This is a **placeholder**; replace with real branding when ready.

````python
import sys
from PIL import Image, ImageDraw

S = 1024  # supersample, downscaled to 128
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Rounded-square background (placeholder palette — swap for real branding)
d.rounded_rectangle((0, 0, S - 1, S - 1), radius=S // 5, fill=(30, 27, 75, 255))

# Ghost body: semicircular head + straight sides + three-scallop hem
cx, top, w = S // 2, int(S * 0.20), int(S * 0.52)
left, right = cx - w // 2, cx + w // 2
head_r = w // 2
hem_y = int(S * 0.76)
d.pieslice((left, top, right, top + 2 * head_r), 180, 360, fill=(240, 240, 250, 255))
d.rectangle((left, top + head_r, right, hem_y), fill=(240, 240, 250, 255))
n = 3
seg = w / n
for i in range(n):
    x0 = left + i * seg
    d.ellipse((x0, hem_y - seg / 2, x0 + seg, hem_y + seg / 2), fill=(240, 240, 250, 255))
# carve notches between scallops so the hem looks wavy
for i in range(n + 1):
    pass

# Eyes + mouth
eye = (30, 27, 75, 255)
ey = top + head_r + int(S * 0.02)
r = int(S * 0.045)
for ex in (cx - int(w * 0.20), cx + int(w * 0.20)):
    d.ellipse((ex - r, ey - r, ex + r, ey + r), fill=eye)
d.ellipse((cx - int(r * 0.9), ey + int(S * 0.09), cx + int(r * 0.9), ey + int(S * 0.09) + int(r * 2.1)), fill=eye)

img.resize((128, 128), Image.LANCZOS).save(sys.argv[1])
print("wrote", sys.argv[1])
````

### Optional: `host-smoke.cjs` (stubbed VS Code API smoke test)

Loads the **built** `dist/extension.js` with a hand-written fake `vscode` module and drives `activate()` end to end, including spawning the real worker. Run `node host-smoke.cjs <path-to-extension-root>`. It is not in the zip; save it as `test/host-smoke.cjs` if you want to keep it. See section 8 for what it asserts.

````js
// Loads the BUILT extension with a stubbed `vscode` module and drives activate() for real,
// including spawning the real worker. Verifies wiring: commands, diagnostics, hover, gutter, status.
const Module = require('module');
const path = require('path');

const ROOT = process.argv[2];
const FIXTURES = path.join(ROOT, 'test', 'fixtures');

const calls = { diagnostics: new Map(), decorations: [], commands: new Map(), hovers: [], status: [], info: [] };

class Position { constructor(l, c) { this.line = l; this.character = c; } }
class Range {
  constructor(a, b, c, d) { this.start = new Position(a, b); this.end = new Position(c, d); }
  contains(p) { return p.line === this.start.line && p.character >= this.start.character && p.character <= this.end.character; }
}
class Diagnostic { constructor(range, message, severity) { Object.assign(this, { range, message, severity }); } }
class MarkdownString { constructor(v = '') { this.value = v; } appendMarkdown(s) { this.value += s; return this; } appendCodeblock(c, l) { this.value += '```' + l + '\n' + c + '\n```'; return this; } }
class Hover { constructor(contents, range) { this.contents = contents; this.range = range; } }
class ThemeColor { constructor(id) { this.id = id; } }
const Uri = { file: (p) => ({ fsPath: p, scheme: 'file', toString: () => 'file://' + p }), joinPath: (b, ...s) => ({ fsPath: path.join(b.fsPath, ...s), scheme: 'file', toString: () => 'file://' + path.join(b.fsPath, ...s) }) };

const settings = { scanOnSave: true, scanOnStartup: true, paths: ['.'], showGutterIcons: true };
const noopDisp = { dispose() {} };
const fakeEditor = { document: { uri: Uri.file(path.join(FIXTURES, 'styles', 'demo.module.css')), languageId: 'css' }, setDecorations: (d, r) => calls.decorations.push(r.length) };

const vscode = {
  Range, Position, Diagnostic, MarkdownString, Hover, ThemeColor, Uri,
  DiagnosticSeverity: { Warning: 1 }, DiagnosticTag: { Unnecessary: 1 }, OverviewRulerLane: { Right: 4 }, StatusBarAlignment: { Left: 1 },
  window: {
    createOutputChannel: () => ({ appendLine() {}, dispose() {} }),
    createTextEditorDecorationType: () => ({ dispose() {} }),
    createStatusBarItem: () => { const s = { show() { calls.status.push(String(s.text)); }, dispose() {} }; return s; },
    visibleTextEditors: [fakeEditor],
    onDidChangeVisibleTextEditors: () => noopDisp,
    showInformationMessage: async (m) => { calls.info.push(m); },
  },
  languages: {
    createDiagnosticCollection: () => ({ set: (u, d) => calls.diagnostics.set(u.fsPath, d), clear: () => calls.diagnostics.clear(), dispose() {} }),
    registerHoverProvider: (sel, p) => { calls.hovers.push({ sel, p }); return noopDisp; },
  },
  workspace: {
    workspaceFolders: [{ uri: Uri.file(FIXTURES) }],
    getConfiguration: () => ({ get: (k, d) => (k in settings ? settings[k] : d) }),
    onDidSaveTextDocument: (fn) => { calls.onSave = fn; return noopDisp; },
    onDidChangeConfiguration: () => noopDisp,
    getWorkspaceFolder: () => ({}),
  },
  commands: { registerCommand: (id, fn) => { calls.commands.set(id, fn); return noopDisp; }, executeCommand: async () => {} },
};

const orig = Module._load;
Module._load = function (request, ...rest) { return request === 'vscode' ? vscode : orig.call(this, request, ...rest); };

const ext = require(path.join(ROOT, 'dist', 'extension.js'));
const ctx = { subscriptions: [], extensionUri: Uri.file(ROOT), extensionPath: ROOT };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = require('assert');

(async () => {
  ext.activate(ctx);
  assert.deepStrictEqual([...calls.commands.keys()].sort(), ['css-ghost.clearResults', 'css-ghost.scanWorkspace']);
  await sleep(1500); // startup scan runs in the real worker

  const byFile = Object.fromEntries([...calls.diagnostics].map(([f, d]) => [path.basename(f), d.map((x) => x.message).sort()]));
  console.log('diagnostics after startup scan:', JSON.stringify(byFile));
  assert.deepStrictEqual(byFile, {
    'Button.module.css': ['.disabled appears to be unused', '.iconRight appears to be unused'],
    'demo.module.css': ['.ghost appears to be unused', '.phantom appears to be unused'],
  });

  // Hover on `.ghost` (demo.module.css line 7 -> 0-based 6, col 0..6)
  const provider = calls.hovers[0].p;
  const doc = fakeEditor.document;
  const ghostDiag = calls.diagnostics.get(path.join(FIXTURES, 'styles', 'demo.module.css')).find((d) => d.message.startsWith('.ghost'));
  const h = provider.provideHover(doc, new Position(ghostDiag.range.start.line, ghostDiag.range.start.character + 2));
  console.log('hover on .ghost:\n' + h.contents.value);
  assert.ok(h.contents.value.includes('This selector appears to be unused'));
  assert.strictEqual(provider.provideHover(doc, new Position(0, 2)), undefined, 'no hover on a used selector');

  assert.ok(calls.decorations.includes(2), 'gutter decorations applied to the visible editor');
  assert.ok(calls.status.some((s) => s.includes('4')), 'status bar shows 4 orphans: ' + calls.status.join(' | '));

  // Command palette command -> rescan + summary toast
  await calls.commands.get('css-ghost.scanWorkspace')();
  await sleep(1500);
  console.log('toast:', calls.info.at(-1));
  assert.ok(/4 unused selectors in 2 files/.test(calls.info.at(-1)));

  // Save of a component file triggers a debounced rescan; clear then save repopulates
  await calls.commands.get('css-ghost.clearResults')();
  assert.strictEqual(calls.diagnostics.size, 0);
  calls.onSave({ uri: Uri.file(path.join(FIXTURES, 'components', 'Demo.jsx')), fileName: path.join(FIXTURES, 'components', 'Demo.jsx') });
  await sleep(2000);
  assert.strictEqual(calls.diagnostics.size, 2, 'on-save rescan repopulated diagnostics');

  // Non-relevant save is ignored
  calls.diagnostics.clear();
  calls.onSave({ uri: Uri.file('/x/readme.md'), fileName: '/x/readme.md' });
  await sleep(1000);
  assert.strictEqual(calls.diagnostics.size, 0, 'markdown save ignored');

  ctx.subscriptions.forEach((s) => s.dispose && s.dispose());
  console.log('HOST SMOKE OK');
  process.exit(0);
})().catch((e) => { console.error('HOST SMOKE FAILED:', e); process.exit(1); });
````

---

## 8. Testing

Three levels were run.

**1. Typecheck.** `npm run typecheck` (`tsc --noEmit`) passes with `strict: true`. It also runs automatically in `vscode:prepublish`.

**2. Worker tests** (`npm test` builds, then runs `node --test test/worker.test.mjs`). Four tests, all passing:

- finds exactly the expected orphans in the fixtures (`disabled`, `iconRight`, `ghost`, `phantom`) and no dynamic files;
- each reported column range slices to exactly `.<name>` in the source line, and the rule preview contains the selector;
- overlapping scan paths do not produce duplicate files;
- a missing scan directory returns no results rather than throwing.

**3. Stubbed-host smoke test** (`host-smoke.cjs`, section 7). Passed. It asserts:

- both commands are registered;
- startup scan produces the four diagnostics with the message `.<name> appears to be unused`;
- hover on `.ghost` returns "This selector appears to be unused" plus the CSS rule, and hover on a used selector returns nothing;
- gutter decorations are applied to the visible editor and the status bar shows 4;
- the **Scan workspace** command shows "4 unused selectors in 2 files";
- **Clear results** empties diagnostics, a save of `Demo.jsx` repopulates them, and a save of a `.md` file is ignored.

**4. Packaging.** `npx vsce package` succeeds: 10 files, about 16.8 KB.

**What has not been tested:** a real Extension Development Host. In particular, check by eye that the squiggle ranges, the faded text, the gutter icon in light and dark themes, and the hover rendering look right, and that the `workspaceContains` activation event fires on a fresh window.

---

## 9. Publishing

Pre-flight:

- Put the extension in a public GitHub repo and add a `repository` field to `package.json`. This lets `vsce` rewrite relative links in the README. It is currently omitted because the repo location is undecided, and `vsce package` needs `--allow-missing-repository` until it is set.
- Check that the name `css-ghost` is free on the Marketplace (not verified). The Marketplace requires a unique extension name per publisher.
- Icon must be a PNG of at least 128 px (it is). SVG images in the README and CHANGELOG are blocked, except from trusted badge providers, and all image URLs must be HTTPS.
- Keep `keywords` to 30 or fewer.

### Visual Studio Marketplace

1. Create a publisher at <https://marketplace.visualstudio.com/manage> using a Microsoft account. The publisher ID must match `"publisher": "rolandjlevy"` in `package.json`. It cannot be changed later.
2. **Easiest first release, no token:** `npm run package`, then upload the `.vsix` on the management page.
3. **Command line:** create a Personal Access Token in Azure DevOps (Organization: *All accessible organizations*; Scopes: *Custom defined* → *Marketplace* → *Manage*). Then:

   ```bash
   npx vsce login rolandjlevy     # paste the PAT
   npx vsce publish               # or: npx vsce publish minor   (bumps version, commits, tags)
   ```

   A 401 or 403 usually means the wrong organization or scope was chosen.

4. **Heads-up:** the VS Code publishing docs state that global Azure DevOps PATs are retired on **1 December 2026**. For automation, use Microsoft Entra ID with workload identity federation and `vsce publish --azure-credential` (vsce 2.26.1 or later). For manual releases, uploading the `.vsix` avoids PATs entirely. Re-check the docs before relying on a PAT.

### Open VSX (VSCodium, Eclipse Theia and other editors)

1. Create an Eclipse account using the same GitHub username you use on <https://open-vsx.org>.
2. Log in to open-vsx.org with GitHub, open profile settings, log in with Eclipse, and sign the **Publisher Agreement**.
3. Settings → Access Tokens → generate a token. It is shown once.
4. Publish:

   ```bash
   npx ovsx create-namespace rolandjlevy -p <token>
   npx ovsx publish css-ghost-0.1.0.vsix -p <token>
   ```

   Creating a namespace does not verify it; claiming ownership is a separate step.

### Releasing updates

- Bump `version` in `package.json` and add a `CHANGELOG.md` entry.
- If the core changed, raise the `@rolandjlevy/css-ghost` dependency range and run `npm install`. Publishing the CLI to npm does not update the extension by itself.
- Pre-release channel: `vsce publish --pre-release`. Only `major.minor.patch` versions are supported (no semver pre-release tags), pre-release and release versions must differ, and the common convention is odd minor for pre-release, even for release.
- A GitHub Actions workflow that runs `npm test` and then `vsce publish` on a tag is a sensible next step. See <https://code.visualstudio.com/api/working-with-extensions/continuous-integration>.

---

## 10. Known limitations and suggested follow-ups

**Extension behaviour**

- Scans read from **disk**, so results update on **save**, not as you type. Line numbers drift between an unsaved edit and the next save.
- Every trigger is a **full-workspace rescan**. Fine for typical projects; very large monorepos may want caching or incremental scans.
- Changes made outside the editor (git checkout, formatters on disk, other tools) do not trigger a scan. A `FileSystemWatcher` on the same glob would cover that.
- Only `file:` workspaces. Multi-root workspaces are handled (paths resolve per folder).
- No Quick Fix yet. A natural next feature is a `CodeActionProvider` offering "Remove unused rule".
- No test against a real VS Code host yet. `@vscode/test-electron` would allow proper integration tests.

**Core quirks** (from reading `parser.js` and `scanner.js`; these affect the CLI too and are best fixed there)

1. **`hasDynamic` is workspace-wide.** `scan()` sets it for every style file when *any* component file matches ``/`[^`]*\$\{[^}]+\}[^`]*`/``, i.e. any template literal with `${}` anywhere, not only inside `className` or `styles[...]`. In typical React code this is nearly always true. Narrowing that check would make the warning meaningful.
2. **Usage is global across files**, so a class name used by any component counts as used for every stylesheet with the same name. In the fixtures, `.button` and `.primary` in `demo.module.css` count as used partly because `Button.jsx` uses the same names. Per-file import tracking (`import styles from './x.module.css'`) would remove these false negatives.
3. **Likely SCSS/Less nesting weakness (untested, from code reading):** `extractCssSelectors` ends a rule at the first `}`, so nested rules may be mis-segmented.
4. **Likely `@import 'x.css'` weakness (untested):** a line outside a rule containing `.css` could be read as a selector named `css`.
5. `styles?\.foo` also matches `props.style.foo`, which can mark unrelated names as used.
6. Only the first occurrence of a class name per file is recorded, with that first rule as its preview.

**Packaging and API**

- Add a proper programmatic entry point or `"exports"` map to the CLI package (for example `import { scan } from '@rolandjlevy/css-ghost'`), and update `core.d.ts` / the deep import to match. Consider shipping `.d.ts` types from the core so `core.d.ts` can be deleted.
- Replace the placeholder icon with real branding. Add a Marketplace banner colour and screenshots/GIF to the README.

---

## 11. Problems hit while building, and fixes

| Problem | Cause | Fix |
| --- | --- | --- |
| `vsce package` would reject the build | `npm install` pulled `@types/vscode@1.140.0`, newer than `engines.vscode: ^1.85.0` | Pinned `@types/vscode` to exactly `1.85.0`. Keep it ≤ the `engines.vscode` floor |
| `npm test` failed with "Cannot find module '.../test'" | `node --test test/` treated the directory as a module under Node 22 | Script now names the file: `node --test test/worker.test.mjs` |
| Stubbed-host hover check returned `undefined` | The test hard-coded the wrong position for `.ghost` | Test now derives the position from the diagnostic range |

---

## 12. Where the extension code should live in the repo

This document goes in `docs/`. The extension itself needs a home, and either works:

- **A. Separate repo** (for example `rolandjlevy/css-ghost-vscode`). Cleanest for Marketplace publishing and its own CI. Depends on the CLI through npm.
- **B. Subfolder of the existing repo** (for example `vscode-extension/`). The CLI's `package.json` has `"files": ["bin", "src", "README.md"]`, so a subfolder would not leak into the npm package. The extension could depend on the local core via `"@rolandjlevy/css-ghost": "file:.."`, but be aware that `vsce` and esbuild bundling then follow a symlink, so test `npm run package` after switching. Publish the extension and the CLI on independent versions.

If you pick B, adjust the `repository` field to include `"directory": "vscode-extension"`.

---

## 13. Brief to paste into an AI coding tool

> You are continuing work on **css-ghost for VS Code** (publisher `rolandjlevy`, v0.1.0). Read `docs/vscode-extension.md` fully first; it contains the architecture, every source file, and the test plan.
>
> **Context:** the extension wraps the existing `@rolandjlevy/css-ghost` npm package (`scan(dirs)` from `src/scanner.js`, synchronous, returns `{ filePath, total, orphaned: [{ name, line, rule }], hasDynamic, dynamicFiles }[]`). The scan runs in a worker thread (`src/worker.ts`), results become `vscode.Diagnostic`s plus gutter decorations and a hover provider (`src/extension.ts`). Built with esbuild to CJS.
>
> **First tasks, in order:**
> 1. Recreate the project from section 7 (or use the provided `css-ghost-vscode.zip`), run `npm install && npm test`, and confirm four passing tests.
> 2. Launch with F5 and manually verify the checklist in section 6. Report anything that differs from expectations, especially squiggle ranges, gutter icon on light/dark themes, and activation.
> 3. Add a `FileSystemWatcher` so external file changes trigger a debounced rescan.
> 4. Add a `CodeActionProvider` quick fix: "Remove unused rule" (use the `rule` text / diagnostic range; handle multi-line rules).
> 5. Add `@vscode/test-electron` integration tests.
> 6. Fix the core quirks listed in section 10 in the CLI repo first (workspace-wide `hasDynamic`, per-file usage tracking), then bump the extension dependency.
> 7. Set up GitHub Actions to run tests and publish on tag (see section 9; prefer Entra ID over a PAT because global Azure DevOps PATs retire on 1 Dec 2026).
>
> **Rules:** keep the extension's scan logic delegated to the core package, so no copied parser code. Never commit or push without explicit permission from the user. Keep `@types/vscode` pinned at or below `engines.vscode`. Keep `src/worker.ts` as the only place the synchronous core runs.

---

## 14. Links

**Project**

- css-ghost repository: <https://github.com/rolandjlevy/css-ghost>
- css-ghost on npm: <https://www.npmjs.com/package/@rolandjlevy/css-ghost>
- Originating Claude Code session: <https://claude.ai/code/session_019BY5HrQAPx5us3xptNu3h9>

**Publishing**

- Publishing Extensions (VS Code docs, includes PAT and Entra ID): <https://code.visualstudio.com/api/working-with-extensions/publishing-extension>
- `vsce` CLI reference: <https://code.visualstudio.com/docs/tools/vscecli>
- Visual Studio Marketplace publisher management: <https://marketplace.visualstudio.com/manage>
- Continuous Integration for extensions: <https://code.visualstudio.com/api/working-with-extensions/continuous-integration>
- Open VSX registry: <https://open-vsx.org>
- Open VSX publishing guide: <https://github.com/eclipse/openvsx/wiki/Publishing-Extensions>
- `ovsx` CLI on npm: <https://www.npmjs.com/package/ovsx>

**VS Code extension API (background for the features used)**

- Extension API reference: <https://code.visualstudio.com/api/references/vscode-api>
- Your first extension: <https://code.visualstudio.com/api/get-started/your-first-extension>
- Bundling extensions: <https://code.visualstudio.com/api/working-with-extensions/bundling-extension>
- Activation events: <https://code.visualstudio.com/api/references/activation-events>
- Extension manifest: <https://code.visualstudio.com/api/references/extension-manifest>
- Testing extensions: <https://code.visualstudio.com/api/working-with-extensions/testing-extension>

Pages in the Publishing and Open VSX groups were read during the build session. The VS Code API links are standard documentation URLs that were not fetched during the session.

---

## Files delivered in the originating session

| File | What it is |
| --- | --- |
| `css-ghost-vscode.zip` | Project source (no `node_modules` or `dist`), 24 files, about 46 KB |
| `css-ghost-0.1.0.vsix` | Built, installable package, about 17 KB |

Both appear as downloadable file cards in the session linked above. Everything in them is also reproduced in section 7 of this document.
