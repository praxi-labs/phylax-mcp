import { describe, expect, it } from 'vitest'

import { verdictReport } from '../../lib/format.js'

describe('unevaluated artifacts', () => {
  it('does not present an uncovered artifact as allowed', () => {
    const out = verdictReport('pkg:npm/express@4.18.2', {
      verdict: 'ALLOW',
      coverage: 'none',
      reason: 'This artifact has not been evaluated by the network.',
    })
    const body = out.content[0]?.text ?? ''
    expect(body).toContain('NOT EVALUATED')
    expect(body).not.toContain('ALLOW for')
    expect(out.isError).toBeUndefined()
  })

  it('still reports a real verdict normally', () => {
    const out = verdictReport('pkg:npm/evil', { verdict: 'BLOCK', coverage: 'full' })
    expect(out.content[0]?.text ?? '').toContain('BLOCK for')
    expect(out.isError).toBe(true)
  })
})
