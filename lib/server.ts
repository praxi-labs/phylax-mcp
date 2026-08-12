import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { PhylaxSdk } from '@phylax/sdk'

import type { PhylaxMcpConfig } from './env.js'
import { createTools } from './tools.js'
import { SERVER_NAME, SERVER_VERSION } from './version.js'

export function createConfiguredServer(config: PhylaxMcpConfig): McpServer {
  const sdk = new PhylaxSdk({
    apiToken: config.apiToken,
    baseUrl: config.baseUrl,
    userAgent: `${SERVER_NAME}/${SERVER_VERSION}`,
  })

  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION })

  for (const tool of createTools(sdk)) {
    server.tool(tool.name, tool.description, tool.inputSchema, async args =>
      tool.handler(args as Record<string, unknown>),
    )
  }

  return server
}
