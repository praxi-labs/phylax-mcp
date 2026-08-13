import type { PhylaxResult } from '@phyi/sdk'

export interface ToolOutput {
  [key: string]: unknown
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export function text(body: string, isError = false): ToolOutput {
  return {
    content: [{ type: 'text', text: body }],
    ...(isError ? { isError } : {}),
  }
}

const HINTS: Record<string, string> = {
  unauthenticated: 'Check that PHYLAX_API_TOKEN is set and has not been revoked.',
  plan_required: 'This capability is not part of the current subscription plan.',
  forbidden: 'The token is missing a permission required for this call.',
  quota_exceeded: 'The plan quota is spent for the current period.',
  rate_limited: 'Rate limited. Retry shortly.',
  not_found: 'The artifact may not have been analysed yet.',
}

export function failure(
  action: string,
  result: { status: number; code: string; error: string; cause?: string | undefined },
): ToolOutput {
  const hint = HINTS[result.code] ?? ''
  const cause = result.cause ? `\n${result.cause}` : ''
  return text(
    `${action} failed (${result.code}, HTTP ${result.status}): ${result.error}. ${hint}${cause}`.trim(),
    true,
  )
}

export function verdictReport(
  subject: string,
  data: Record<string, unknown>,
): ToolOutput {
  const verdict = String(data['verdict'] ?? 'UNKNOWN').toUpperCase()
  const lines = [`${verdict} for ${subject}`, '']

  const add = (label: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== '') {
      lines.push(`${label}: ${String(value)}`)
    }
  }

  add('risk score', data['risk_score'] ?? data['score'] ?? data['risk'])
  add('provenance', data['provenance'])

  const attestation = data['attestation']
  if (attestation && typeof attestation === 'object') {
    const a = attestation as Record<string, unknown>
    add('attestation', a['available'] ? `available (${a['count'] ?? 1})` : 'none')
  } else {
    add('attestation', attestation)
  }

  const findings = data['findings']
  if (Array.isArray(findings) && findings.length > 0) {
    lines.push('', `findings (${findings.length}):`)
    for (const entry of findings.slice(0, 10)) {
      const finding = entry as Record<string, unknown>
      const severity = String(finding['severity'] ?? 'unknown').toUpperCase()
      lines.push(`  [${severity}] ${finding['title'] ?? finding['type'] ?? 'unnamed'}`)
    }
    if (findings.length > 10) {
      lines.push(`  and ${findings.length - 10} more`)
    }
  }

  if (verdict === 'BLOCK') {
    lines.push('', 'Do not install, execute, or enable this artifact.')
  }

  return text(lines.join('\n'), verdict === 'BLOCK')
}

export function unwrap<T>(
  action: string,
  result: PhylaxResult<T>,
): { ok: true; data: T } | { ok: false; output: ToolOutput } {
  if (!result.success) {
    return { ok: false, output: failure(action, result) }
  }
  return { ok: true, data: result.data }
}
