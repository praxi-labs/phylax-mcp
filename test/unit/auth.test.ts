import { describe, expect, it } from 'vitest'

import { authenticateRequest } from '../../lib/auth.js'

const TOKEN = 'shared-secret-value'

function jwtWithAudience(aud: string | string[]): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ aud })).toString('base64url')
  return `${header}.${payload}.`
}

describe('authenticateRequest', () => {
  it('accepts a matching bearer token', () => {
    expect(authenticateRequest(`Bearer ${TOKEN}`, TOKEN)).toEqual({ authorized: true })
  })

  it('is case insensitive on the scheme', () => {
    expect(authenticateRequest(`bearer ${TOKEN}`, TOKEN)).toEqual({ authorized: true })
  })

  it('rejects a missing header with 401', () => {
    const result = authenticateRequest(undefined, TOKEN)
    expect(result).toEqual({
      authorized: false,
      status: 401,
      reason: 'Missing Authorization header',
    })
  })

  it('rejects a non bearer scheme with 401', () => {
    const result = authenticateRequest(`Basic ${TOKEN}`, TOKEN)
    expect(result.authorized).toBe(false)
    expect(result.authorized === false && result.status).toBe(401)
  })

  it('rejects a wrong token with 403 rather than 401', () => {
    const result = authenticateRequest('Bearer wrong', TOKEN)
    expect(result.authorized).toBe(false)
    expect(result.authorized === false && result.status).toBe(403)
  })

  it('does not throw when the presented token differs in length', () => {
    expect(() => authenticateRequest('Bearer x', TOKEN)).not.toThrow()
  })

  it('rejects a token minted for another audience', () => {
    const token = jwtWithAudience('https://other.example')
    const result = authenticateRequest(`Bearer ${token}`, token, 'https://mcp.phyi.dev')

    expect(result.authorized).toBe(false)
    expect(result.authorized === false && result.reason).toMatch(/audience/)
  })

  it('accepts a token whose audience list includes this server', () => {
    const token = jwtWithAudience(['https://mcp.phyi.dev', 'https://other.example'])
    expect(
      authenticateRequest(`Bearer ${token}`, token, 'https://mcp.phyi.dev'),
    ).toEqual({ authorized: true })
  })

  it('ignores audience when the server does not configure one', () => {
    const token = jwtWithAudience('https://other.example')
    expect(authenticateRequest(`Bearer ${token}`, token)).toEqual({ authorized: true })
  })
})
