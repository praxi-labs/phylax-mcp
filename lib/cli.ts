import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { readConfig, type PhylaxMcpConfig } from './env.js'
import { createConfiguredServer } from './server.js'
import { SERVER_NAME, SERVER_VERSION } from './version.js'

export interface CliDeps {
  config: PhylaxMcpConfig
  log: (message: string) => void
  startHttp: (config: PhylaxMcpConfig) => Promise<void>
  connectStdio: (config: PhylaxMcpConfig) => Promise<void>
}

export function createCliDeps(argv: string[] = process.argv.slice(2)): CliDeps {
  const config = readConfig()

  if (argv.includes('--http')) {
    config.transport = 'http'
  }
  const portFlag = argv.indexOf('--port')
  if (portFlag !== -1 && argv[portFlag + 1]) {
    const port = Number(argv[portFlag + 1])
    if (Number.isFinite(port)) {
      config.port = port
    }
  }

  return {
    config,
    log: message => process.stderr.write(`${message}\n`),
    startHttp: async cfg => {
      const { startHttpServer } = await import('./http-server.js')
      await startHttpServer(cfg)
    },
    connectStdio: async cfg => {
      const server = createConfiguredServer(cfg)
      await server.connect(new StdioServerTransport())
    },
  }
}

export async function runCli(deps: CliDeps): Promise<number> {
  const { config, log, startHttp, connectStdio } = deps

  if (config.transport === 'http') {
    if (!config.httpAuthToken) {
      log(
        'Refusing to start. PHYLAX_MCP_AUTH_TOKEN is required for the HTTP transport, ' +
          'because an unauthenticated endpoint grants tool execution to anyone who can ' +
          'reach the port. Use the default stdio transport for local use.',
      )
      return 1
    }
    log(`${SERVER_NAME} ${SERVER_VERSION} listening on port ${config.port}`)
    await startHttp(config)
    return 0
  }

  await connectStdio(config)
  log(`${SERVER_NAME} ${SERVER_VERSION} ready on stdio`)
  return 0
}

export function reportStartupFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${SERVER_NAME}: failed to start. ${message}\n`)
  process.exitCode = 1
}
