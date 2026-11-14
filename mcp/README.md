# css-ghost-mcp

Let your AI assistant find unused CSS in your project: class selectors and `--custom-properties`, with file and line numbers. An [MCP](https://modelcontextprotocol.io) server for [css-ghost](https://www.npmjs.com/package/css-ghost).

**Read-only**: it never edits files or reads outside your project. Runs locally, nothing to host. Needs Node.js 18+.

## Quick start (Claude Code)

```bash
# 1. Add it once, for all projects
claude mcp add --scope user css-ghost -- npx -y css-ghost-mcp

# 2. Start Claude from your project's root folder (it scans the folder you start in)
cd path/to/your-project
claude
```

3. Type `/mcp` and check that `css-ghost` is connected.
4. Ask: *"Find unused CSS in this project and tell me which is safe to remove."*

Other good questions: *"Summarise unused CSS"*, *"List unused selectors in `src/components`"*, *"Which of these were removed from components recently?"*

<details>
<summary><strong>Cursor</strong></summary>

Add to `.cursor/mcp.json` (one project) or `~/.cursor/mcp.json` (all projects):

```json
{ "mcpServers": { "css-ghost": { "command": "npx", "args": ["-y", "css-ghost-mcp"] } } }
```

If it scans the wrong folder, add your project's full path after `"css-ghost-mcp"`.
</details>

<details>
<summary><strong>VS Code</strong></summary>

Add to `.vscode/mcp.json`:

```json
{ "servers": { "css-ghost": { "type": "stdio", "command": "npx", "args": ["-y", "css-ghost-mcp", "${workspaceFolder}"] } } }
```
</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Claude Desktop has no project folder, so give it the path. In `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`):

```json
{ "mcpServers": { "css-ghost": { "command": "npx", "args": ["-y", "css-ghost-mcp", "/full/path/to/your-project"] } } }
```

Restart Claude Desktop.
</details>

## Tools

The assistant picks these itself; you don't need to name them.

| Tool | Returns |
| --- | --- |
| `summarise_orphans` | Unused counts per file and the 10 worst files. A good first look. |
| `find_orphans` | Each unused selector and custom property with file and line (50 by default, max 200). |
| `ghost_trail` | The last git commit that added or removed each name, to tell recent work from long-dead styles. Needs git. |

**`uncertain: true`** marks results near code that builds class names at runtime (`styles[variant]`, `` `btn-${size}` ``). css-ghost can't see those usages, so check before removing.

## Choosing the folder

It scans the folder your client starts it in. To set it yourself, pass a path as the last argument or set `CSS_GHOST_ROOT`. In a monorepo, use the repo root: a class counts as used if any component uses it.

## Troubleshooting

- **`Server "css-ghost" not found`.** Not registered in this session. Run `claude mcp list`. If you added it without `--scope user`, it only exists in the folder you added it from. Restart `claude` after adding.
- **Empty or wrong results.** It's scanning a different folder. Start from the project root or pass the path.
- **"MCP resources" list is empty.** Expected: it provides tools, not resources.

## Safety

Every tool is read-only. Paths outside the project (including via symlinks) are refused. Project config files are never executed. Output is capped so a big project can't flood the assistant's context.

---

Source: [github.com/rolandjlevy/css-ghost](https://github.com/rolandjlevy/css-ghost) (`mcp/` folder). Develop with `npm install --no-save .. && npm test` inside `mcp/`.
