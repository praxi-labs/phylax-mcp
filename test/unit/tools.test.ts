import { describe, expect, it, vi } from 'vitest'

import { PhylaxSdk } from '@phylax/sdk'

import { createTools } from '../../lib/tools.js'

function sdkReturning(body: unknown, status = 200): PhylaxSdk {
  const fetchImpl = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
  return new PhylaxSdk({
    apiToken: 'phx_live_test',
    fetch: fetchImpl as never,
    maxRetries: 1,
  })
}

const toolNamed = (sdk: PhylaxSdk, name: string) => {
  const tool = createTools(sdk).find(t => t.name === name)
  if (!tool) {
    throw new Error(`tool ${name} not registered`)
  }
  return tool
}

const bodyOf = (output: { content: Array<{ text: string }> }) =>
  output.content.map(c => c.text).join('\n')

describe('tool registration', () => {
  it('exposes only product tools', () => {
    const names = createTools(sdkReturning({})).map(t => t.name).sort()
    expect(names).toEqual([
      'check_policy',
      'get_attestation',
      'phylax_status',
      'search_artifacts',
      'verify_artifact',
      'verify_artifacts',
      'verify_mcp_server',
    ])
  })

  it('gives every tool a description long enough to route on', () => {
    for (const tool of createTools(sdkReturning({}))) {
      expect(tool.description.length).toBeGreaterThan(60)
    }
  })
})

describe('verify_artifact', () => {
  it('reports the verdict first so it cannot be summarised away', async () => {
    const sdk = sdkReturning({ artifact: 'pkg:npm/x@1', verdict: 'ALLOW', risk_score: 12 })
    const out = await toolNamed(sdk, 'verify_artifact').handler({
      artifact: 'pkg:npm/x@1',
    })

    expect(bodyOf(out).startsWith('ALLOW')).toBe(true)
    expect(out.isError).toBeUndefined()
  })

  it('marks a BLOCK as an error so the model treats it as a hard stop', async () => {
    const sdk = sdkReturning({ artifact: 'pkg:npm/bad@1', verdict: 'BLOCK' })
    const out = await toolNamed(sdk, 'verify_artifact').handler({
      artifact: 'pkg:npm/bad@1',
    })

    expect(out.isError).toBe(true)
    expect(bodyOf(out)).toMatch(/Do not install/)
  })

  it('rejects an empty artifact without calling the API', async () => {
    const out = await toolNamed(sdkReturning({}), 'verify_artifact').handler({
      artifact: '   ',
    })
    expect(out.isError).toBe(true)
  })

  it('explains a plan failure rather than returning a bare status', async () => {
    const sdk = sdkReturning({ detail: 'upgrade required' }, 402)
    const out = await toolNamed(sdk, 'verify_artifact').handler({
      artifact: 'pkg:npm/x@1',
    })

    expect(out.isError).toBe(true)
    expect(bodyOf(out)).toMatch(/plan_required/)
    expect(bodyOf(out)).toMatch(/subscription plan/)
  })

  it('explains a missing token', async () => {
    const sdk = sdkReturning({}, 401)
    const out = await toolNamed(sdk, 'verify_artifact').handler({
      artifact: 'pkg:npm/x@1',
    })

    expect(bodyOf(out)).toMatch(/PHYLAX_API_TOKEN/)
  })
})

describe('verify_artifacts', () => {
  it('summarises a batch and flags when any is blocked', async () => {
    const sdk = sdkReturning([
      { artifact: 'pkg:npm/a@1', verdict: 'ALLOW' },
      { artifact: 'pkg:npm/b@2', verdict: 'BLOCK' },
    ])
    const out = await toolNamed(sdk, 'verify_artifacts').handler({
      artifacts: ['pkg:npm/a@1', 'pkg:npm/b@2'],
    })

    expect(out.isError).toBe(true)
    expect(bodyOf(out)).toMatch(/1 of 2 artifacts are BLOCKED/)
  })

  it('passes a clean batch', async () => {
    const sdk = sdkReturning([{ artifact: 'pkg:npm/a@1', verdict: 'ALLOW' }])
    const out = await toolNamed(sdk, 'verify_artifacts').handler({
      artifacts: ['pkg:npm/a@1'],
    })

    expect(out.isError).toBeUndefined()
    expect(bodyOf(out)).toMatch(/All 1 artifacts passed/)
  })

  it('requires at least one artifact', async () => {
    const out = await toolNamed(sdkReturning({}), 'verify_artifacts').handler({
      artifacts: [],
    })
    expect(out.isError).toBe(true)
  })
})

describe('get_attestation', () => {
  it('reports absence plainly rather than as a failure', async () => {
    const sdk = sdkReturning({ items: [] })
    const out = await toolNamed(sdk, 'get_attestation').handler({
      artifact: 'pkg:npm/x@1',
    })

    expect(out.isError).toBeUndefined()
    expect(bodyOf(out)).toMatch(/No attestations found/)
  })
})
