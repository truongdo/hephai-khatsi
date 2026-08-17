// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TYPESENSE_MEMBERS_COLLECTION,
  TYPESENSE_TEMPLES_COLLECTION,
  type MemberSearchDoc,
  type TempleSearchDoc,
} from '#/domain/searchDocs'

const HOST = 'https://typesense.test'
const API_KEY = 'fake-api-key'

const membersSchema = {
  name: TYPESENSE_MEMBERS_COLLECTION,
  fields: [
    { name: 'id', type: 'string' },
    { name: 'orgUnitId', type: 'string', facet: true },
    { name: 'sanghaType', type: 'string', facet: true },
    { name: 'status', type: 'string', facet: true },
    { name: 'phapDanh', type: 'string' },
    { name: 'theDanh', type: 'string' },
    { name: 'cccd', type: 'string' },
    { name: 'dienThoai', type: 'string' },
    { name: 'updatedAt', type: 'int64' },
  ],
  default_sorting_field: 'updatedAt',
}

const templesSchema = {
  name: TYPESENSE_TEMPLES_COLLECTION,
  fields: [
    { name: 'id', type: 'string' },
    { name: 'orgUnitId', type: 'string', facet: true },
    { name: 'status', type: 'string', facet: true },
    { name: 'danhHieu', type: 'string' },
    { name: 'truTriPhapDanh', type: 'string' },
    { name: 'phones', type: 'string[]' },
    { name: 'updatedAt', type: 'int64' },
  ],
  default_sorting_field: 'updatedAt',
}

const sampleMember: MemberSearchDoc = {
  id: 'm1',
  orgUnitId: 'gd-i',
  sanghaType: 'tang',
  status: 'draft',
  phapDanh: 'Phap Danh',
  theDanh: 'The Danh',
  cccd: '012345678901',
  dienThoai: '0901234567',
  updatedAt: 1700000000000,
}

const sampleTemple: TempleSearchDoc = {
  id: 't1',
  orgUnitId: 'gd-i',
  status: 'draft',
  danhHieu: 'Tinh Xa',
  truTriPhapDanh: 'Tri Phap',
  phones: ['0901234567'],
  updatedAt: 1700000000000,
}

let fetchMock: ReturnType<typeof vi.fn>

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    return handler(url, init)
  })
  vi.stubGlobal('fetch', fetchMock)
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createTypesenseClient', () => {
  describe('ensureCollections', () => {
    it('creates collections when GET returns 404', async () => {
      const created: string[] = []
      mockFetch((url, init) => {
        if (
          url === `${HOST}/collections/${TYPESENSE_MEMBERS_COLLECTION}` &&
          init?.method !== 'POST'
        ) {
          return new Response('Not found', { status: 404 })
        }
        if (
          url === `${HOST}/collections/${TYPESENSE_TEMPLES_COLLECTION}` &&
          init?.method !== 'POST'
        ) {
          return new Response('Not found', { status: 404 })
        }
        if (
          url === `${HOST}/collections` &&
          init?.method === 'POST' &&
          init.body
        ) {
          const body = JSON.parse(init.body as string)
          created.push(body.name)
          return new Response(JSON.stringify(body), { status: 201 })
        }
        return new Response('unexpected', { status: 500 })
      })

      const { createTypesenseClient } = await import('./typesenseClient')
      const client = createTypesenseClient({
        TYPESENSE_API_KEY: API_KEY,
        TYPESENSE_HOST: HOST,
      })
      await client.ensureCollections()

      expect(created).toEqual([
        TYPESENSE_MEMBERS_COLLECTION,
        TYPESENSE_TEMPLES_COLLECTION,
      ])

      const postCalls = fetchMock.mock.calls.filter(
        ([, init]) => init?.method === 'POST' && String(init?.body).includes('fields'),
      )
      expect(postCalls.length).toBe(2)

      const membersCreate = JSON.parse(postCalls[0][1]?.body as string)
      expect(membersCreate).toEqual(membersSchema)

      const templesCreate = JSON.parse(postCalls[1][1]?.body as string)
      expect(templesCreate).toEqual(templesSchema)
    })

    it('skips create when GET returns 200', async () => {
      mockFetch((url, init) => {
        if (url.startsWith(`${HOST}/collections/`) && init?.method !== 'POST') {
          return new Response(JSON.stringify({ name: url.split('/').pop() }), { status: 200 })
        }
        if (url === `${HOST}/collections` && init?.method === 'POST') {
          return new Response('should not create', { status: 500 })
        }
        return new Response('unexpected', { status: 500 })
      })

      const { createTypesenseClient } = await import('./typesenseClient')
      const client = createTypesenseClient({
        TYPESENSE_API_KEY: API_KEY,
        TYPESENSE_HOST: HOST,
      })
      await client.ensureCollections()

      const postCreates = fetchMock.mock.calls.filter(
        ([url, init]) => url === `${HOST}/collections` && init?.method === 'POST',
      )
      expect(postCreates).toHaveLength(0)
    })
  })

  describe('recreateCollections', () => {
    it('deletes existing collections then recreates schemas', async () => {
      const deleted: string[] = []
      const created: string[] = []
      mockFetch((url, init) => {
        if (
          url === `${HOST}/collections/${TYPESENSE_MEMBERS_COLLECTION}` &&
          init?.method === 'DELETE'
        ) {
          deleted.push(TYPESENSE_MEMBERS_COLLECTION)
          return new Response('{}', { status: 200 })
        }
        if (
          url === `${HOST}/collections/${TYPESENSE_TEMPLES_COLLECTION}` &&
          init?.method === 'DELETE'
        ) {
          deleted.push(TYPESENSE_TEMPLES_COLLECTION)
          return new Response('{}', { status: 200 })
        }
        if (
          url.startsWith(`${HOST}/collections/`) &&
          init?.method !== 'POST' &&
          init?.method !== 'DELETE'
        ) {
          return new Response(JSON.stringify({ name: url.split('/').pop() }), { status: 200 })
        }
        if (url === `${HOST}/collections` && init?.method === 'POST' && init.body) {
          const body = JSON.parse(init.body as string)
          created.push(body.name)
          return new Response(JSON.stringify(body), { status: 201 })
        }
        return new Response('unexpected', { status: 500 })
      })

      const { createTypesenseClient } = await import('./typesenseClient')
      const client = createTypesenseClient({
        TYPESENSE_API_KEY: API_KEY,
        TYPESENSE_HOST: HOST,
      })
      await client.recreateCollections()

      expect(deleted).toEqual([
        TYPESENSE_MEMBERS_COLLECTION,
        TYPESENSE_TEMPLES_COLLECTION,
      ])
      expect(created).toEqual([
        TYPESENSE_MEMBERS_COLLECTION,
        TYPESENSE_TEMPLES_COLLECTION,
      ])
    })

    it('creates collections when GET returns 404', async () => {
      const created: string[] = []
      mockFetch((url, init) => {
        if (
          url.startsWith(`${HOST}/collections/`) &&
          init?.method !== 'POST'
        ) {
          return new Response('Not found', { status: 404 })
        }
        if (url === `${HOST}/collections` && init?.method === 'POST' && init.body) {
          const body = JSON.parse(init.body as string)
          created.push(body.name)
          return new Response(JSON.stringify(body), { status: 201 })
        }
        return new Response('unexpected', { status: 500 })
      })

      const { createTypesenseClient } = await import('./typesenseClient')
      const client = createTypesenseClient({
        TYPESENSE_API_KEY: API_KEY,
        TYPESENSE_HOST: HOST,
      })
      await client.recreateCollections()

      expect(created).toEqual([
        TYPESENSE_MEMBERS_COLLECTION,
        TYPESENSE_TEMPLES_COLLECTION,
      ])

      const deleteCalls = fetchMock.mock.calls.filter(
        ([, init]) => init?.method === 'DELETE',
      )
      expect(deleteCalls).toHaveLength(0)
    })
  })

  describe('multiSearch', () => {
    it('POSTs multi_search with API key, two searches, and parses hits', async () => {
      let capturedBody: unknown
      mockFetch((url, init) => {
        if (url === `${HOST}/multi_search` && init?.method === 'POST') {
          capturedBody = JSON.parse(init.body as string)
          return new Response(
            JSON.stringify({
              results: [
                { hits: [{ document: sampleMember }] },
                { hits: [{ document: sampleTemple }] },
              ],
            }),
          )
        }
        return new Response('unexpected', { status: 500 })
      })

      const { createTypesenseClient } = await import('./typesenseClient')
      const client = createTypesenseClient({
        TYPESENSE_API_KEY: API_KEY,
        TYPESENSE_HOST: HOST,
      })
      const result = await client.multiSearch({
        q: 'phap',
        filterBy: 'orgUnitId:=gd-i',
        perPage: 8,
      })

      expect(result).toEqual({ members: [sampleMember], temples: [sampleTemple] })

      const [, init] = fetchMock.mock.calls.find(
        ([u]) => u === `${HOST}/multi_search`,
      )!
      expect(init?.headers).toMatchObject({ 'X-TYPESENSE-API-KEY': API_KEY })

      expect(capturedBody).toEqual({
        searches: [
          {
            collection: TYPESENSE_MEMBERS_COLLECTION,
            q: 'phap',
            query_by: 'phapDanh,theDanh,cccd,dienThoai',
            filter_by: 'orgUnitId:=gd-i',
            per_page: 8,
            prefix: true,
          },
          {
            collection: TYPESENSE_TEMPLES_COLLECTION,
            q: 'phap',
            query_by: 'danhHieu,truTriPhapDanh,phones',
            filter_by: 'orgUnitId:=gd-i',
            per_page: 8,
            prefix: true,
          },
        ],
      })
    })
  })

  describe('upsert', () => {
    it('POSTs document with action=upsert', async () => {
      let capturedUrl = ''
      let capturedBody: unknown
      mockFetch((url, init) => {
        if (init?.method === 'POST' && url.includes('/documents')) {
          capturedUrl = url
          capturedBody = JSON.parse(init.body as string)
          return new Response(JSON.stringify(sampleMember), { status: 201 })
        }
        return new Response('unexpected', { status: 500 })
      })

      const { createTypesenseClient } = await import('./typesenseClient')
      const client = createTypesenseClient({
        TYPESENSE_API_KEY: API_KEY,
        TYPESENSE_HOST: HOST,
      })
      await client.upsert(TYPESENSE_MEMBERS_COLLECTION, sampleMember)

      expect(capturedUrl).toBe(
        `${HOST}/collections/${TYPESENSE_MEMBERS_COLLECTION}/documents?action=upsert`,
      )
      expect(capturedBody).toEqual(sampleMember)
    })
  })

  describe('importDocuments', () => {
    it('throws when NDJSON response contains success:false', async () => {
      mockFetch((url, init) => {
        if (url.includes('/documents/import') && init?.method === 'POST') {
          return new Response(
            '{"success":true}\n{"success":false,"error":"Field `id` is required"}\n',
            { status: 200 },
          )
        }
        return new Response('unexpected', { status: 500 })
      })

      const { createTypesenseClient } = await import('./typesenseClient')
      const client = createTypesenseClient({
        TYPESENSE_API_KEY: API_KEY,
        TYPESENSE_HOST: HOST,
      })

      await expect(
        client.importDocuments(TYPESENSE_MEMBERS_COLLECTION, [sampleMember]),
      ).rejects.toThrow('Typesense import failed: Field `id` is required')
    })

    it('resolves when all NDJSON lines succeed', async () => {
      mockFetch((url, init) => {
        if (url.includes('/documents/import') && init?.method === 'POST') {
          return new Response('{"success":true}\n{"success":true}\n', { status: 200 })
        }
        return new Response('unexpected', { status: 500 })
      })

      const { createTypesenseClient } = await import('./typesenseClient')
      const client = createTypesenseClient({
        TYPESENSE_API_KEY: API_KEY,
        TYPESENSE_HOST: HOST,
      })

      await expect(
        client.importDocuments(TYPESENSE_MEMBERS_COLLECTION, [sampleMember, sampleMember]),
      ).resolves.toBeUndefined()
    })
  })

  describe('deleteDocument', () => {
    it('DELETEs document by id', async () => {
      let capturedUrl = ''
      let method = ''
      mockFetch((url, init) => {
        if (init?.method === 'DELETE') {
          capturedUrl = url
          method = init.method
          return new Response('{}', { status: 200 })
        }
        return new Response('unexpected', { status: 500 })
      })

      const { createTypesenseClient } = await import('./typesenseClient')
      const client = createTypesenseClient({
        TYPESENSE_API_KEY: API_KEY,
        TYPESENSE_HOST: HOST,
      })
      await client.deleteDocument(TYPESENSE_MEMBERS_COLLECTION, 'm1')

      expect(method).toBe('DELETE')
      expect(capturedUrl).toBe(
        `${HOST}/collections/${TYPESENSE_MEMBERS_COLLECTION}/documents/m1`,
      )
    })
  })
})
