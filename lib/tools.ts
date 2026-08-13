import { z } from 'zod'

import type { PhylaxSdk } from '@phyi/sdk'
import { failure, text, unwrap, verdictReport, type ToolOutput } from './format.js'

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: z.ZodRawShape
  handler: (args: Record<string, unknown>) => Promise<ToolOutput>
}

const asRecord = (value: unknown) => value as unknown as Record<string, unknown>

export function createTools(sdk: PhylaxSdk): ToolDefinition[] {
  return [
    {
      name: 'verify_artifact',
      description:
        'Verify a software artifact before installing, executing or depending on it. ' +
        'Accepts a package URL such as pkg:npm/express@4.18.2 or pkg:pypi/requests@2.32.3. ' +
        'Returns ALLOW, WARN or BLOCK with a risk score and findings. ' +
        'Call this before suggesting an install command for any third party package.',
      inputSchema: {
        artifact: z.string().describe('Package URL, for example pkg:npm/express@4.18.2'),
        policy: z
          .string()
          .optional()
          .describe('Named policy to evaluate against. Omit for the default.'),
      },
      async handler(args) {
        const artifact = String(args['artifact'] ?? '').trim()
        if (!artifact) {
          return text('An artifact reference is required.', true)
        }
        const policy = args['policy'] ? String(args['policy']) : undefined
        const result = await sdk.artifacts.verify(artifact, { policy })
        const out = unwrap('Verification', result)
        return out.ok ? verdictReport(artifact, asRecord(out.data)) : out.output
      },
    },

    {
      name: 'verify_artifacts',
      description:
        'Verify many artifacts in a single call. Use when checking a dependency list, ' +
        'a lockfile, or several candidate packages at once. Preferred over calling ' +
        'verify_artifact repeatedly.',
      inputSchema: {
        artifacts: z
          .array(z.string())
          .min(1)
          .max(200)
          .describe('Package URLs to verify'),
        policy: z.string().optional(),
      },
      async handler(args) {
        const artifacts = Array.isArray(args['artifacts'])
          ? (args['artifacts'] as string[])
          : []
        if (artifacts.length === 0) {
          return text('At least one artifact reference is required.', true)
        }
        const policy = args['policy'] ? String(args['policy']) : undefined
        const result = await sdk.artifacts.verifyMany(artifacts, { policy })
        const out = unwrap('Batch verification', result)
        if (!out.ok) {
          return out.output
        }

        const rows = Array.isArray(out.data) ? out.data : []
        const blocked = rows.filter(
          row => String(asRecord(row)['verdict']).toUpperCase() === 'BLOCK',
        )
        const summary = rows
          .map(row => {
            const record = asRecord(row)
            return `${String(record['verdict'] ?? 'UNKNOWN').toUpperCase()}  ${record['artifact'] ?? ''}`
          })
          .join('\n')

        const header =
          blocked.length > 0
            ? `${blocked.length} of ${rows.length} artifacts are BLOCKED.\n\n`
            : `All ${rows.length} artifacts passed.\n\n`

        return text(header + summary, blocked.length > 0)
      },
    },

    {
      name: 'verify_mcp_server',
      description:
        'Verify a Model Context Protocol server before connecting to it or enabling its tools. ' +
        'Checks provenance, requested permissions, the tool surface for unsafe operations, ' +
        'and known risk signals. Call before adding any third party MCP server.',
      inputSchema: {
        server: z
          .string()
          .describe('MCP server reference or URL, for example mcp://acme/postgres-tools'),
      },
      async handler(args) {
        const server = String(args['server'] ?? '').trim()
        if (!server) {
          return text('An MCP server reference is required.', true)
        }
        const result = await sdk.artifacts.verify(server)
        const out = unwrap('MCP server verification', result)
        return out.ok ? verdictReport(server, asRecord(out.data)) : out.output
      },
    },

    {
      name: 'get_attestation',
      description:
        'Fetch the signed attestations behind an artifact verdict. Use when the user asks ' +
        'for evidence, provenance detail, or wants to verify offline.',
      inputSchema: {
        artifact: z.string().describe('Package URL to fetch attestations for'),
        limit: z.number().int().positive().max(50).optional(),
      },
      async handler(args) {
        const artifact = String(args['artifact'] ?? '').trim()
        if (!artifact) {
          return text('An artifact reference is required.', true)
        }
        const limit = typeof args['limit'] === 'number' ? args['limit'] : undefined
        const result = await sdk.attestations.list(artifact, {
          ...(limit ? { limit } : {}),
        })
        const out = unwrap('Attestation lookup', result)
        if (!out.ok) {
          return out.output
        }
        const items = (out.data as { items?: unknown[] }).items ?? []
        return items.length === 0
          ? text(`No attestations found for ${artifact}.`)
          : text(
              `${items.length} attestation(s) for ${artifact}:\n\n${JSON.stringify(items, null, 2)}`,
            )
      },
    },

    {
      name: 'check_policy',
      description:
        'Evaluate an artifact against an organization policy and return the decision. ' +
        'Use when the user asks whether something is allowed by their rules, rather than ' +
        'whether it is generally safe.',
      inputSchema: {
        artifact: z.string().describe('Package URL to evaluate'),
        policy: z.string().optional().describe('Policy id. Omit for the default.'),
      },
      async handler(args) {
        const artifact = String(args['artifact'] ?? '').trim()
        if (!artifact) {
          return text('An artifact reference is required.', true)
        }
        const policy = args['policy'] ? String(args['policy']) : undefined
        const result = await sdk.policies.evaluate({ artifact, policy })
        const out = unwrap('Policy evaluation', result)
        return out.ok ? verdictReport(artifact, asRecord(out.data)) : out.output
      },
    },

    {
      name: 'search_artifacts',
      description:
        'Search Phylax for artifacts by name. Use to resolve a vague package name to a ' +
        'concrete package URL before verifying it.',
      inputSchema: {
        query: z.string().describe('Search term, for example express'),
        ecosystem: z
          .string()
          .optional()
          .describe('Restrict to npm, pypi, golang, cargo, maven or oci'),
      },
      async handler(args) {
        const query = String(args['query'] ?? '').trim()
        if (!query) {
          return text('A search query is required.', true)
        }
        const ecosystem = args['ecosystem'] ? String(args['ecosystem']) : undefined
        const result = await sdk.artifacts.search(query, {
          ...(ecosystem ? { ecosystem } : {}),
        })
        const out = unwrap('Search', result)
        if (!out.ok) {
          return out.output
        }
        const items = (out.data as { items?: unknown[] }).items ?? []
        return items.length === 0
          ? text(`No artifacts matched "${query}".`)
          : text(JSON.stringify(items, null, 2))
      },
    },

    {
      name: 'phylax_status',
      description:
        'Check that the Phylax API is reachable, the token works, and report the current ' +
        'plan and remaining quota. Use when other tools fail, to tell an outage apart from ' +
        'a plan or credential problem.',
      inputSchema: {},
      async handler() {
        const health = await sdk.health()
        if (!health.success) {
          return failure('Status check', health)
        }

        const entitlements = await sdk.quota.entitlements()
        if (!entitlements.success) {
          return text('Phylax API reachable. Plan details unavailable.')
        }

        const data = entitlements.data
        return text(
          [
            'Phylax API reachable.',
            `plan: ${data.plan}`,
            `quota remaining: ${data.quota_remaining ?? 'unknown'}`,
          ].join('\n'),
        )
      },
    },
  ]
}
