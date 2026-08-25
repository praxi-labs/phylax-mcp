import { describe, expect, it, vi } from 'vitest'

import { PhylaxSdk } from '@phyi/sdk'

import { createDittoGateTools } from '../../lib/ditto-gate.js'

function sdkReturning(body: unknown, status = 200): PhylaxSdk {
  const fetchImpl = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
  const auth = ['phx', 'live', 'test'].join('_')
  return new PhylaxSdk({
    apiToken: auth,
    fetch: fetchImpl as never,
    maxRetries: 1,
  })
}

const toolNamed = (sdk: PhylaxSdk, name: string) => {
  const tool = createDittoGateTools(sdk).find(t => t.name === name)
  if (!tool) {
    throw new Error(`tool ${name} not registered`)
  }
  return tool
}

const bodyOf = (output: { content: Array<{ text: string }> }) =>
  output.content.map(c => c.text).join('\n')

describe('ditto_gate_status', () => {
  it('blocks when the network verdict is BLOCK', async () => {
    const sdk = sdkReturning({ artifact: 'mcp://ditto-assistant/ditto-mcp', verdict: 'BLOCK' })
    const out = await toolNamed(sdk, 'ditto_gate_status').handler({})

    expect(out.isError).toBe(true)
    expect(bodyOf(out)).toMatch(/^BLOCKED/)
  })

  it('blocks an unevaluated artifact even though the raw verdict is ALLOW', async () => {
    const sdk = sdkReturning({
      artifact: 'mcp://ditto-assistant/ditto-mcp',
      verdict: 'ALLOW',
      coverage: 'none',
      reason: 'This artifact has not been evaluated by the network.',
    })
    const out = await toolNamed(sdk, 'ditto_gate_status').handler({})

    expect(out.isError).toBe(true)
    expect(bodyOf(out)).toMatch(/^BLOCKED/)
    expect(bodyOf(out)).toMatch(/NOT EVALUATED/)
  })

  it('allows a covered ALLOW verdict through', async () => {
    const sdk = sdkReturning({
      artifact: 'mcp://ditto-assistant/ditto-mcp',
      verdict: 'ALLOW',
      coverage: 'network',
    })
    const out = await toolNamed(sdk, 'ditto_gate_status').handler({})

    expect(out.isError).toBeUndefined()
    expect(bodyOf(out)).toMatch(/^ALLOWED/)
  })
})

describe('call_ditto_tool', () => {
  it('refuses to reach Ditto when the gate is BLOCKed, without needing a live server', async () => {
    const sdk = sdkReturning({ artifact: 'mcp://ditto-assistant/ditto-mcp', verdict: 'BLOCK' })
    const out = await toolNamed(sdk, 'call_ditto_tool').handler({ tool: 'search_memory' })

    expect(out.isError).toBe(true)
    expect(bodyOf(out)).toMatch(/Refusing to call Ditto MCP/)
  })

  it('refuses an unevaluated artifact by default', async () => {
    const sdk = sdkReturning({
      artifact: 'mcp://ditto-assistant/ditto-mcp',
      verdict: 'ALLOW',
      coverage: 'none',
    })
    const out = await toolNamed(sdk, 'call_ditto_tool').handler({})

    expect(out.isError).toBe(true)
    expect(bodyOf(out)).toMatch(/Refusing to call Ditto MCP/)
  })
})
