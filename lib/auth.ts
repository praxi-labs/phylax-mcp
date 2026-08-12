import { timingSafeEqual } from 'node:crypto'

export type AuthOutcome =
  | { authorized: true }
  | { authorized: false; status: 401 | 403; reason: string }

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

function readAudience(token: string): string[] | undefined {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) {
    return undefined
  }
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as { aud?: string | string[] }
    if (!payload.aud) {
      return undefined
    }
    return Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  } catch {
    return undefined
  }
}

export function authenticateRequest(
  authorizationHeader: string | undefined,
  expectedToken: string,
  audience?: string | undefined,
): AuthOutcome {
  if (!authorizationHeader) {
    return { authorized: false, status: 401, reason: 'Missing Authorization header' }
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim())
  if (!match?.[1]) {
    return { authorized: false, status: 401, reason: 'Expected a Bearer token' }
  }

  const presented = match[1]

  if (!safeEqual(presented, expectedToken)) {
    return { authorized: false, status: 403, reason: 'Token rejected' }
  }

  if (audience) {
    const aud = readAudience(presented)
    if (aud && !aud.includes(audience)) {
      return {
        authorized: false,
        status: 403,
        reason: 'Token audience does not match this server',
      }
    }
  }

  return { authorized: true }
}
