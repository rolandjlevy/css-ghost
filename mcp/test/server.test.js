import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const bin = fileURLToPath(new URL('../bin/css-ghost-mcp.js', import.meta.url));
const fixtures = resolve(fileURLToPath(new URL('../../test', import.meta.url)));

let client;

before(async () => {
  client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [bin, fixtures] }));
});

after(async () => {
  await client.close();
});

test('the server lists exactly three read-only tools', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['find_orphans', 'ghost_trail', 'summarise_orphans']);
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.ok(tool.description.length > 40, `${tool.name} needs a real description`);
  }
});

test('find_orphans works over the real protocol', async () => {
  const res = await client.callTool({ name: 'find_orphans', arguments: { path: 'scss' } });
  assert.notEqual(res.isError, true);
  assert.equal(res.structuredContent.totalOrphans.selectors, 3);
  assert.equal(JSON.parse(res.content[0].text).totalOrphans.variables, 2);
});

test('a path outside the root comes back as a tool error the model can read', async () => {
  const res = await client.callTool({ name: 'find_orphans', arguments: { path: '/etc' } });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /outside the project directory/);
});

test('invalid input is rejected before the tool runs', async () => {
  const res = await client.callTool({ name: 'ghost_trail', arguments: { names: [] } }).catch((e) => ({ isError: true, content: [{ text: String(e.message) }] }));
  assert.equal(res.isError, true);
});
