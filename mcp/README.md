# css-ghost-mcp

An [MCP](https://modelcontextprotocol.io) server that lets an AI assistant (Claude, Cursor, VS Code and others) find unused CSS in your project using [css-ghost](https://www.npmjs.com/package/css-ghost).

It is **read-only**. It never edits or deletes anything, never leaves the project directory, and runs locally over stdio, so there is nothing to host.

## Set up

Add it to your MCP client's config. For Claude Desktop, Cursor and most others:

```json
{
  "mcpServers": {
    "css-ghost": {
      "command": "npx",
      "args": ["-y", "css-ghost-mcp"]
    }
  }
}
```

With Claude Code: `claude mcp add css-ghost -- npx -y css-ghost-mcp`

The project root is the directory the client starts the server in. To pin it, pass a path as the last argument, or set `CSS_GHOST_ROOT`.

Then ask your assistant something like: "Find unused CSS in this project and tell me which of it is safe to remove."

## Tools

| Tool | What it does |
| --- | --- |
| `summarise_orphans` | Counts per file and the ten worst files. Small output, call it first on a big project. |
| `find_orphans` | Unused class selectors and custom properties with file and line. Capped at 50 items by default (200 max), with a count of what was left out. |
| `ghost_trail` | For up to 25 names, the last git commit that added or removed them in component code. Tells recent work in progress from long-dead styles. |

Items from files that build class names at runtime (`styles[variable]`, template literals) come back with `uncertain: true`. css-ghost cannot see those usages, so they may still be in use. A good assistant checks them before removing anything.

## Safety

- Every tool is read-only and says so in its MCP annotations.
- Paths are resolved against the project root; anything outside it (including through symlinks) is refused.
- Project config files are not executed. Only the `ignore` argument is honoured.
- Output is capped so a large project cannot flood the model's context.

## Development

```bash
npm install --no-save ..   # link the local css-ghost checkout
npm test
```

`css-ghost-mcp` needs css-ghost 1.4.0 or later, which exports `isGitRepo` and `getGhostTrails`.
