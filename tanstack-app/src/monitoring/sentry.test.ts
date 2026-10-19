import { describe, expect, it } from 'vitest'
import { scrubBreadcrumb, scrubEvent, scrubSpan, stripQuery } from './sentry'

describe('stripQuery', () => {
  it('drops query string and hash', () => {
    expect(
      stripQuery('https://x.vn/f/public/edit/temple?orgUnitId=gd&phone=0937103910'),
    ).toBe('https://x.vn/f/public/edit/temple')
    expect(stripQuery('/a#b')).toBe('/a')
    expect(stripQuery('/a')).toBe('/a')
  })
})

describe('scrubEvent', () => {
  it('removes the phone number from the request url and query', () => {
    const event = scrubEvent({
      request: {
        url: 'https://x.vn/f/public/edit/member?phone=0937103910',
        query_string: 'phone=0937103910',
      },
    })
    expect(event.request?.url).toBe('https://x.vn/f/public/edit/member')
    expect(event.request?.query_string).toBeUndefined()
  })
})

describe('scrubBreadcrumb', () => {
  it('strips queries from navigation and fetch breadcrumbs', () => {
    expect(
      scrubBreadcrumb({
        category: 'navigation',
        data: { from: '/f/public?phone=1', to: '/f/public/edit?phone=1' },
      }).data,
    ).toEqual({ from: '/f/public', to: '/f/public/edit' })
  })
})

describe('scrubSpan', () => {
  it('strips queries from the name and URL attributes and drops query keys', () => {
    const span = scrubSpan({
      trace_id: 't',
      span_id: 's',
      name: 'GET https://x.vn/f/public/edit?phone=0937103910',
      start_timestamp: 0,
      status: 'ok',
      is_segment: false,
      attributes: {
        'url.full': 'https://x.vn/f/public/edit?phone=0937103910',
        'http.query': '?phone=0937103910',
        'sentry.op': 'http.client',
        'url.path': { value: '/f/public?phone=1', type: 'string' },
      },
    } as unknown as Parameters<typeof scrubSpan>[0])
    expect(span.name).toBe('GET https://x.vn/f/public/edit')
    expect(span.attributes).toEqual({
      'url.full': 'https://x.vn/f/public/edit',
      'sentry.op': 'http.client',
      'url.path': { value: '/f/public', type: 'string' },
    })
  })
})
