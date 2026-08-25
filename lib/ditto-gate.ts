import { z } from 'zod'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

import type { PhylaxSdk } from '@phyi/sdk'
import { text, unwrap, verdictReport, type ToolOutput } from './format.js'
import type { ToolDefinition } from './tools.js'

const DITTO_REF = 'mcp://ditto-assistant/ditto-mcp'

let dittoClient: Client | undefined

async function getDittoClient(): Promise<Client> {
  if (dittoClient) {
    return dittoClient
  }
  const transport = new StdioClientTransport({
    command: 'pnpm',
    args: ['dlx', '@heyditto/mcp', 'stdio'],
  })
  const client = new Client({ name: 'phylax-mcp-ditto-gate', version: '0.1.0' })
  await client.connect(transport)
  dittoClient = client
  return client
}

interface GateCheck {
  allowed: boolean
  report: ToolOutput
}

async function checkGate(sdk: PhylaxSdk): Promise<GateCheck> {
  const result = await sdk.artifacts.verify(DITTO_REF)
  const out = unwrap('Ditto gate check', result)
  if (!out.ok) {
    return { allowed: false, report: out.output }
  }

  const data = out.data as Record<string, unknown>
  const verdict = String(data['verdict'] ?? 'UNKNOWN').toUpperCase()
  const coverage = String(data['coverage'] ?? '')
  return {
    allowed: verdict === 'ALLOW' && coverage !== 'none',
    report: verdictReport(DITTO_REF, data),
  }
}

const reportText = (report: ToolOutput) => report.content[0]?.text ?? ''

export function createDittoGateTools(sdk: PhylaxSdk): ToolDefinition[] {
  return [
    {
      name: 'ditto_gate_status',
      description:
        'Check whether Ditto MCP (heyditto.ai) is currently allowed through the Phylax gate, ' +
        'and why. Call before call_ditto_tool if you want the reason without attempting a call.',
      inputSchema: {},
      async handler() {
        const { allowed, report } = await checkGate(sdk)
        return text(
          `${allowed ? 'ALLOWED' : 'BLOCKED'} — pass-through to Ditto MCP tools is currently ` +
            `${allowed ? 'permitted' : 'refused'}.\n\n${reportText(report)}`,
          !allowed,
        )
      },
    },

    {
      name: 'call_ditto_tool',
      description:
        'Call a tool on the Ditto MCP server (heyditto.ai), gated by a live Phylax verdict. ' +
        'Refuses if Ditto is BLOCKed or unevaluated (coverage: none) — a default ALLOW on an ' +
        'unevaluated artifact is not a safety endorsement. Omit `tool` to list what Ditto exposes.',
      inputSchema: {
        tool: z.string().optional().describe('Ditto tool name to call. Omit to list available tools.'),
        args: z.record(z.unknown()).optional().describe('Arguments for the Ditto tool.'),
      },
      async handler(args) {
        const { allowed, report } = await checkGate(sdk)
        if (!allowed) {
          return text(`Refusing to call Ditto MCP — gate check failed.\n\n${reportText(report)}`, true)
        }

        const client = await getDittoClient()
        const toolName = args['tool'] ? String(args['tool']) : undefined
        if (!toolName) {
          const { tools } = await client.listTools()
          return text(
            `Ditto MCP tools:\n${tools.map(t => `- ${t.name}: ${t.description ?? ''}`).join('\n')}`,
          )
        }

        const callArgs = (args['args'] as Record<string, unknown> | undefined) ?? {}
        const result = await client.callTool({ name: toolName, arguments: callArgs })
        return result as unknown as ToolOutput
      },
    },
  ]
}
