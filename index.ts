#!/usr/bin/env node
import { createCliDeps, reportStartupFailure, runCli } from './lib/cli.js'

export { createConfiguredServer } from './lib/server.js'
export { authenticateRequest } from './lib/auth.js'
export { createTools } from './lib/tools.js'
export { readConfig, MissingTokenError } from './lib/env.js'
export type { PhylaxMcpConfig } from './lib/env.js'
export { SERVER_NAME, SERVER_VERSION } from './lib/version.js'

async function main(): Promise<void> {
  process.exitCode = await runCli(createCliDeps())
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop() ?? '')

if (invokedDirectly) {
  main().catch(reportStartupFailure)
}
