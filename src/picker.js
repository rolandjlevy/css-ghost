import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.cache']);

function getDirs(dir) {
  try {
    return readdirSync(dir)
      .filter(f => {
        if (f.startsWith('.') || SKIP.has(f)) return false;
        try { return statSync(join(dir, f)).isDirectory(); }
        catch { return false; }
      })
      .sort();
  } catch { return []; }
}

export async function pickDirectories() {
  return new Promise((done) => {
    let cwd    = process.cwd();
    let dirs   = getDirs(cwd);
    let cursor = 0;
    let selected = [];

    // ANSI helpers (raw — no extra dep)
    const C = {
      reset:  '\x1b[0m',
      bold:   '\x1b[1m',
      dim:    '\x1b[2m',
      invert: '\x1b[7m',
      green:  '\x1b[32m',
      cyan:   '\x1b[36m',
    };

    function render() {
      const lines = [
        '',
        `${C.bold}📂 Directory picker${C.reset}  — navigate into a folder, then press ${C.cyan}[a]${C.reset} to add it`,
        '',
        `${C.dim}📍 ${cwd}${C.reset}`,
        '',
      ];

      if (dirs.length === 0) {
        lines.push(`  ${C.dim}(no subdirectories)${C.reset}`);
      } else {
        dirs.forEach((d, i) => {
          const active = i === cursor;
          lines.push(active
            ? `  ${C.invert} 📁 ${d} ${C.reset}`
            : `    📁 ${d}`);
        });
      }

      lines.push('');

      if (selected.length > 0) {
        lines.push(`${C.green}✅ Added to scan:${C.reset}`);
        selected.forEach(s => lines.push(`   ${C.green}${s}${C.reset}`));
        lines.push('');
      }

      lines.push(
        `${C.dim}[↑↓/jk] navigate  [↵/→] enter  [←] parent  [a] add current dir  [d] done  [^C] quit${C.reset}`
      );

      process.stdout.write('\x1b[H\x1b[J' + lines.join('\n') + '\n');
    }

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\x1b[2J\x1b[H');
    }

    function finish() {
      cleanup();
      done(selected.length > 0 ? selected : [cwd]);
    }

    function goUp() {
      const parent = join(cwd, '..');
      if (parent !== cwd) {
        cwd   = parent;
        dirs  = getDirs(cwd);
        cursor = 0;
      }
    }

    function goInto() {
      if (dirs.length > 0) {
        cwd    = join(cwd, dirs[cursor]);
        dirs   = getDirs(cwd);
        cursor = 0;
      }
    }

    function toggleAdd() {
      const idx = selected.indexOf(cwd);
      if (idx === -1) selected.push(cwd);
      else selected.splice(idx, 1);
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdout.write('\x1b[2J\x1b[H');
    render();

    process.stdin.on('data', (key) => {
      if (key === '\x03')                    { cleanup(); process.exit(0); }       // Ctrl+C
      else if (key === '\x1b[A' || key === 'k') cursor = Math.max(0, cursor - 1); // up
      else if (key === '\x1b[B' || key === 'j') cursor = Math.min(dirs.length - 1, cursor + 1); // down
      else if (key === '\x1b[C' || key === '\r') goInto();  // right / Enter
      else if (key === '\x1b[D' || key === '\x7f') goUp();  // left / backspace
      else if (key === 'a') toggleAdd();
      else if (key === 'd') { finish(); return; }

      if (dirs.length === 0) cursor = 0;
      render();
    });
  });
}
