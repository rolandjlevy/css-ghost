#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../src/server.js';

/* The project root is the first argument, then CSS_GHOST_ROOT, then the current directory.
   The server never reads or writes outside it. Output goes only to stdout as MCP messages;
   logs go to stderr. */
const rootArg = process.argv[2] ?? process.env.CSS_GHOST_ROOT ?? process.cwd();

let root;
try {
  root = realpathSync(resolve(rootArg));
} catch {
  console.error(`css-ghost-mcp: project directory not found: ${rootArg}`);
  process.exit(1);
}

const server = createServer({ root });
await server.connect(new StdioServerTransport());
console.error(`css-ghost-mcp ready, root: ${root}`);
