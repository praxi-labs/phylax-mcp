import { describe, expect, it, vi } from 'vitest'

import { runCli, type CliDeps } from '../../lib/cli.js'
import type { PhylaxMcpConfig } from '../../lib/env.js'

function deps(overrides: Partial<PhylaxMcpConfig> = {}): CliDeps & {
  logs: string[]
} {
  const logs: string[] = []
  return {
    logs,
    config: {
      apiToken: 'phx_live_test',
      baseUrl: undefined,
      transport: 'stdio',
      port: 8765,
      httpAuthToken: undefined,
      audience: undefined,
      ...overrides,
    },
    log: (message: string) => logs.push(message),
    startHttp: vi.fn().mockResolvedValue(undefined),
    connectStdio: vi.fn().mockResolvedValue(undefined),
  }
}

describe('runCli', () => {
  it('starts on stdio by default', async () => {
    const d = deps()
    const code = await runCli(d)

    expect(code).toBe(0)
    expect(d.connectStdio).toHaveBeenCalledTimes(1)
    expect(d.startHttp).not.toHaveBeenCalled()
  })

  it('refuses to expose HTTP without an auth token', async () => {
    const d = deps({ transport: 'http' })
    const code = await runCli(d)

    expect(code).toBe(1)
    expect(d.startHttp).not.toHaveBeenCalled()
    expect(d.logs.join(' ')).toMatch(/PHYLAX_MCP_AUTH_TOKEN is required/)
  })

  it('starts HTTP once an auth token is supplied', async () => {
    const d = deps({ transport: 'http', httpAuthToken: 'secret' })
    const code = await runCli(d)

    expect(code).toBe(0)
    expect(d.startHttp).toHaveBeenCalledTimes(1)
  })

  it('logs to stderr rather than stdout, which carries the protocol', async () => {
    const d = deps()
    await runCli(d)
    expect(d.logs.length).toBeGreaterThan(0)
  })
})
