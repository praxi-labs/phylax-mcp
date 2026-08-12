import { createServer } from 'node:http'

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

import { authenticateRequest } from './auth.js'
import type { PhylaxMcpConfig } from './env.js'
import { createConfiguredServer } from './server.js'

export async function startHttpServer(config: PhylaxMcpConfig): Promise<void> {
  if (!config.httpAuthToken) {
    throw new Error('httpAuthToken is required for the HTTP transport')
  }
  const expectedToken = config.httpAuthToken

  const server = createConfiguredServer(config)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
  await server.connect(transport)

  const http = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }

    const outcome = authenticateRequest(
      req.headers.authorization,
      expectedToken,
      config.audience,
    )

    if (!outcome.authorized) {
      res.writeHead(outcome.status, {
        'content-type': 'application/json',
        'www-authenticate': 'Bearer realm="phylax-mcp"',
      })
      res.end(JSON.stringify({ error: outcome.reason }))
      return
    }

    void transport.handleRequest(req, res)
  })

  await new Promise<void>(resolve => http.listen(config.port, resolve))
}
