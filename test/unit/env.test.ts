import { describe, expect, it } from 'vitest'

import { MissingTokenError, readConfig } from '../../lib/env.js'

describe('readConfig', () => {
  it('requires an API token', () => {
    expect(() => readConfig({})).toThrow(MissingTokenError)
    expect(() => readConfig({ PHYLAX_API_TOKEN: '   ' })).toThrow(MissingTokenError)
  })

  it('accepts either token variable', () => {
    expect(readConfig({ PHYLAX_API_TOKEN: 'a' }).apiToken).toBe('a')
    expect(readConfig({ PHYLAX_API_KEY: 'b' }).apiToken).toBe('b')
  })

  it('prefers PHYLAX_API_TOKEN when both are set', () => {
    expect(
      readConfig({ PHYLAX_API_TOKEN: 'a', PHYLAX_API_KEY: 'b' }).apiToken,
    ).toBe('a')
  })

  it('defaults to the stdio transport', () => {
    expect(readConfig({ PHYLAX_API_TOKEN: 'a' }).transport).toBe('stdio')
  })

  it('selects http only on an exact match', () => {
    expect(
      readConfig({ PHYLAX_API_TOKEN: 'a', PHYLAX_MCP_TRANSPORT: 'http' }).transport,
    ).toBe('http')
    expect(
      readConfig({ PHYLAX_API_TOKEN: 'a', PHYLAX_MCP_TRANSPORT: 'HTTP' }).transport,
    ).toBe('stdio')
  })

  it('falls back to the default port when the value is not numeric', () => {
    expect(
      readConfig({ PHYLAX_API_TOKEN: 'a', PHYLAX_MCP_PORT: 'not-a-port' }).port,
    ).toBe(8765)
  })
})
