# Phylax MCP Server

[![npm](https://img.shields.io/npm/v/@phyi/mcp?label=npm&color=CB3837)](https://www.npmjs.com/package/@phyi/mcp)

A Model Context Protocol server for [Phylax](https://phyi.dev). Lets AI assistants verify packages, repositories and other MCP servers before using them.

Phylax MCP exposes the Phylax verification API through the Model Context Protocol, so any MCP aware assistant such as Claude, VS Code Copilot, Cursor or Windsurf can check a package, audit a dependency list, or refuse a risky tool as part of a conversation. It runs locally over stdio, or as a shared HTTP server for a team.

## Features

- Verify a package before the assistant suggests installing it
- Verify another MCP server before you connect to it
- Batch verify a whole dependency list in one call
- Evaluate an artifact against your organization policy
- Fetch signed attestations as evidence
- Report the current plan and remaining quota

## Install

Requires a Phylax API token. Create one at [app.phyi.dev](https://app.phyi.dev/marketplace/keys).

### Claude Desktop

```json
{
  "mcpServers": {
    "phylax": {
      "command": "npx",
      "args": ["-y", "@phyi/mcp"],
      "env": {
        "PHYLAX_API_TOKEN": "${PHYLAX_API_TOKEN}"
      }
    }
  }
}
```

| Platform | Config file |
| --- | --- |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

### Cursor

Same shape, in `~/.cursor/mcp.json` for every workspace, or `.cursor/mcp.json` to scope it to one project.

### VS Code

```json
{
  "servers": {
    "phylax": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@phyi/mcp"],
      "env": {
        "PHYLAX_API_TOKEN": "${env:PHYLAX_API_TOKEN}"
      }
    }
  }
}
```

Reference the token rather than pasting it. A literal token in these files gets committed, screen shared and synced between machines.

## Usage

Once connected, ask the assistant to verify something:

> Use Phylax to verify pkg:npm/express@4.18.2 before we add it.

### Tools exposed

| Tool | Purpose |
| --- | --- |
| `verify_artifact` | Verify one package URL and return ALLOW, WARN or BLOCK. |
| `verify_artifacts` | Verify many at once. Preferred for a dependency list. |
| `verify_mcp_server` | Verify another MCP server before connecting to it. |
| `check_policy` | Evaluate an artifact against an organization policy. |
| `get_attestation` | Fetch signed attestations as evidence. |
| `search_artifacts` | Resolve a vague package name to a package URL. |
| `phylax_status` | Reachability, plan and remaining quota. |

A `BLOCK` verdict is returned as a tool error, not as prose. An assistant that reads "this package is risky" as text will often carry on and use it anyway, so the refusal is made structural.

### Self hosting over HTTP

For a team sharing one server rather than spawning one per user:

```sh
PHYLAX_API_TOKEN=... \
PHYLAX_MCP_AUTH_TOKEN=... \
npx @phyi/mcp --http --port 8765
```

The server refuses to start on HTTP without `PHYLAX_MCP_AUTH_TOKEN`. An unauthenticated MCP endpoint grants tool execution to anyone who can reach the port.

Set `PHYLAX_MCP_AUDIENCE` to reject tokens minted for a different service, even when they are otherwise valid.

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `PHYLAX_API_TOKEN` | required | Your Phylax API token. `PHYLAX_API_KEY` also accepted. |
| `PHYLAX_API_BASE_URL` | `https://api.phyi.dev` | |
| `PHYLAX_MCP_TRANSPORT` | `stdio` | Set to `http` for a shared server. |
| `PHYLAX_MCP_PORT` | `8765` | HTTP only. |
| `PHYLAX_MCP_AUTH_TOKEN` | none | Required for HTTP. |
| `PHYLAX_MCP_AUDIENCE` | none | Expected `aud` claim on inbound tokens. |

## Troubleshooting

**The assistant never calls a tool.** The client did not start the server. Run the command yourself to see the error the client swallowed:

```sh
PHYLAX_API_TOKEN=... npx @phyi/mcp
```

**Every tool reports `unauthenticated`.** The token is missing, malformed or revoked. Ask the assistant to run `phylax_status`.

**Every tool reports `plan_required`.** The capability is not part of the current subscription.

**The client shows a broken protocol stream.** Something wrote to stdout. On stdio, stdout carries the protocol; all logging goes to stderr.

## Development

<details>
<summary>Contributor commands</summary>

```sh
npm install
npm run typecheck
npm test
npm run build
```

</details>

## License

MIT

## The rest of Phylax

| Tool | Where to get it |
| --- | --- |
| JavaScript SDK | [`@phyi/sdk`](https://www.npmjs.com/package/@phyi/sdk) on npm |
| Python SDK | [`phylax-sdk`](https://github.com/praxi-labs/phylax-sdk-python), PyPI release pending |
| MCP server | [`@phyi/mcp`](https://www.npmjs.com/package/@phyi/mcp) on npm |
| Agent runtime gate | [`@phyi/runtime-gate`](https://www.npmjs.com/package/@phyi/runtime-gate) on npm |
| VS Code extension | [`phylax.phylax`](https://marketplace.visualstudio.com/items?itemName=phylax.phylax) on the Marketplace |
| GitHub Action | [`praxi-labs/phylax-action`](https://github.com/praxi-labs/phylax-action) |
| Browser extension | [`praxi-labs/phylax-chrome`](https://github.com/praxi-labs/phylax-chrome/releases/latest), Web Store listing pending |

Docs live at [phyi.dev](https://phyi.dev).
