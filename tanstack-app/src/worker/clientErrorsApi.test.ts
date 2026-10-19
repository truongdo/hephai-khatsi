// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  handleClientErrorsApi,
  sanitizeClientErrorReport,
} from './clientErrorsApi'

function post(body: string): Request {
  return new Request('https://example.test/api/client-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sanitizeClientErrorReport', () => {
  it('requires a ref', () => {
    expect(sanitizeClientErrorReport({ form: 'temple' })).toBeNull()
    expect(sanitizeClientErrorReport([])).toBeNull()
  })

  it('keeps known fields, truncates, and drops unknown ones', () => {
    const report = sanitizeClientErrorReport({
      ref: 'ABC234',
      form: 'temple',
      message: 'x'.repeat(1000),
      online: true,
      cccd: '012345678901',
    })
    expect(report).toEqual({
      ref: 'ABC234',
      form: 'temple',
      message: 'x'.repeat(300),
      online: true,
    })
  })
})

describe('handleClientErrorsApi', () => {
  it('logs one JSON line and returns 204', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await handleClientErrorsApi(
      post(JSON.stringify({ ref: 'ABC234', reason: 'signed_in_staff' })),
    )
    expect(response.status).toBe(204)
    expect(log).toHaveBeenCalledTimes(1)
    expect(JSON.parse(log.mock.calls[0]![0] as string)).toMatchObject({
      type: 'client_error',
      ref: 'ABC234',
      reason: 'signed_in_staff',
    })
  })

  it('rejects non-POST, bad JSON, and oversized bodies', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const get = await handleClientErrorsApi(
      new Request('https://example.test/api/client-errors'),
    )
    expect(get.status).toBe(405)
    expect((await handleClientErrorsApi(post('{nope'))).status).toBe(400)
    expect((await handleClientErrorsApi(post('{}'))).status).toBe(400)
    const big = JSON.stringify({ ref: 'A', message: 'x'.repeat(5000) })
    expect((await handleClientErrorsApi(post(big))).status).toBe(413)
  })
})
