export interface PhylaxMcpConfig {
  apiToken: string
  baseUrl: string | undefined
  transport: 'stdio' | 'http'
  port: number
  httpAuthToken: string | undefined
  audience: string | undefined
}

export class MissingTokenError extends Error {
  constructor() {
    super(
      'PHYLAX_API_TOKEN is required. Create a token at https://app.phyi.dev/marketplace/keys',
    )
    this.name = 'MissingTokenError'
  }
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): PhylaxMcpConfig {
  const apiToken = (env['PHYLAX_API_TOKEN'] || env['PHYLAX_API_KEY'] || '').trim()
  if (!apiToken) {
    throw new MissingTokenError()
  }

  const port = Number(env['PHYLAX_MCP_PORT'] ?? 8765)

  return {
    apiToken,
    baseUrl: env['PHYLAX_API_BASE_URL'] || undefined,
    transport: env['PHYLAX_MCP_TRANSPORT'] === 'http' ? 'http' : 'stdio',
    port: Number.isFinite(port) ? port : 8765,
    httpAuthToken: env['PHYLAX_MCP_AUTH_TOKEN'] || undefined,
    audience: env['PHYLAX_MCP_AUDIENCE'] || undefined,
  }
}
