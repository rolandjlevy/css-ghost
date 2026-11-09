import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { findOrphans, ghostTrail, summarise, ToolError, DEFAULT_LIMIT, MAX_LIMIT, MAX_TRAIL_NAMES } from './tools.js';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const pathField = z
  .string()
  .default('.')
  .describe('Directory to scan, relative to the project root (or absolute inside it). Defaults to the whole project.');
const ignoreField = z
  .array(z.string())
  .optional()
  .describe('Extra directory names to skip, for example ["legacy", "vendor"]. node_modules, dist and .next are always skipped.');

function ok(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
}

function fail(err) {
  const message = err instanceof ToolError ? err.message : `css-ghost failed: ${err?.message ?? err}`;
  return { content: [{ type: 'text', text: message }], isError: true };
}

const handle = (fn) => async (args) => {
  try {
    return ok(await fn(args));
  } catch (err) {
    return fail(err);
  }
};

export function createServer({ root }) {
  const server = new McpServer({ name: 'css-ghost', version: '0.1.0' });

  server.registerTool(
    'find_orphans',
    {
      title: 'Find unused CSS',
      description:
        'List CSS class selectors and custom properties (--name) that are defined in style files but never used in components. ' +
        'Read-only. Each item has file, line and kind. Items marked uncertain: true are in files that build class names at runtime, so they may be false positives: verify before removing. ' +
        `Returns at most ${MAX_LIMIT} items (default ${DEFAULT_LIMIT}) and a truncated count. For an overview first, use summarise_orphans.`,
      inputSchema: {
        path: pathField,
        ignore: ignoreField,
        limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`Maximum items to return. Default ${DEFAULT_LIMIT}.`)
      },
      annotations: { title: 'Find unused CSS', ...READ_ONLY }
    },
    handle(({ path, ignore, limit }) => findOrphans({ root, path, ignore, limit }))
  );

  server.registerTool(
    'summarise_orphans',
    {
      title: 'Summarise unused CSS',
      description:
        'Counts of unused selectors and custom properties per file, with the ten worst files. Small output: call this first on a large project, then find_orphans on the worst directory. Read-only.',
      inputSchema: { path: pathField, ignore: ignoreField },
      annotations: { title: 'Summarise unused CSS', ...READ_ONLY }
    },
    handle(({ path, ignore }) => summarise({ root, path, ignore }))
  );

  server.registerTool(
    'ghost_trail',
    {
      title: 'Find when CSS was last used',
      description:
        `For up to ${MAX_TRAIL_NAMES} selector or custom-property names, return the most recent git commit that added or removed them in component code. ` +
        'Use it to judge whether an orphan is recent work in progress or long-dead. Class names can be given with or without the leading dot. Read-only; needs a git repository.',
      inputSchema: {
        names: z.array(z.string().min(1)).min(1).max(MAX_TRAIL_NAMES).describe('Selector names (for example "card-title") or custom properties (for example "--brand-blue").')
      },
      annotations: { title: 'Find when CSS was last used', ...READ_ONLY }
    },
    handle(({ names }) => ghostTrail({ root, names }))
  );

  return server;
}
