// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type MemberSearchDoc,
  type TempleSearchDoc,
} from '#/domain/searchDocs'
import type { Env } from './env'

const verifyFirebaseAdminToken = vi.fn()
const verifyHePhaiAdminToken = vi.fn()
const ensureCollections = vi.fn()
const recreateCollections = vi.fn()
const multiSearch = vi.fn()
const importDocuments = vi.fn()

vi.mock('./verifyFirebaseAdmin', () => ({
  verifyFirebaseAdminToken,
  verifyHePhaiAdminToken,
}))

vi.mock('./typesenseClient', () => ({
  createTypesenseClient: () => ({
    ensureCollections,
    recreateCollections,
    multiSearch,
    importDocuments,
  }),
}))

const PROJECT_ID = 'test-project'

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

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: {} as Fetcher,
    PHOTOS: {} as R2Bucket,
    DB: {} as D1Database,
    R2_ACCOUNT_ID: 'acct',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET_NAME: 'photos',
    FIREBASE_PROJECT_ID: PROJECT_ID,
    FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
    TYPESENSE_API_KEY: 'test-typesense-key',
    ...overrides,
  }
}

function searchRequest(
  body: object,
  token?: string,
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return new Request('https://example.com/api/search', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ensureCollections.mockResolvedValue(undefined)
  recreateCollections.mockResolvedValue(undefined)
  multiSearch.mockResolvedValue({ members: [sampleMember], temples: [sampleTemple] })
  importDocuments.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetModules()
})

describe('handleSearchApi', () => {
  it('returns null for non-search paths', async () => {
    const { handleSearchApi } = await import('./searchApi')

    const response = await handleSearchApi(
      new Request('https://example.com/api/photos/member', { method: 'POST' }),
      makeEnv(),
    )

    expect(response).toBeNull()
  })

  describe('POST /api/search', () => {
    it('returns 401 without token', async () => {
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        searchRequest({ q: 'test' }),
        makeEnv(),
      )

      expect(response!.status).toBe(401)
      expect(multiSearch).not.toHaveBeenCalled()
    })

    it('returns 403 when verify returns null', async () => {
      verifyFirebaseAdminToken.mockResolvedValue(null)
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        searchRequest({ q: 'test' }, 'bad-token'),
        makeEnv(),
      )

      expect(response!.status).toBe(403)
      expect(multiSearch).not.toHaveBeenCalled()
    })

    it('returns empty results for blank query without calling Typesense', async () => {
      verifyFirebaseAdminToken.mockResolvedValue({
        uid: 'admin-1',
        role: 'he_phai_admin',
        orgUnitId: null,
      })
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        searchRequest({ q: '   ' }, 'admin-token'),
        makeEnv(),
      )
      const body = await response!.json()

      expect(response!.status).toBe(200)
      expect(body).toEqual({ members: [], temples: [] })
      expect(multiSearch).not.toHaveBeenCalled()
    })

    it('searches without filter_by for he_phai_admin', async () => {
      verifyFirebaseAdminToken.mockResolvedValue({
        uid: 'admin-1',
        role: 'he_phai_admin',
        orgUnitId: null,
      })
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        searchRequest({ q: 'phap' }, 'admin-token'),
        makeEnv(),
      )
      const body = await response!.json()

      expect(response!.status).toBe(200)
      expect(body).toEqual({ members: [sampleMember], temples: [sampleTemple] })
      expect(multiSearch).toHaveBeenCalledWith({
        q: 'phap',
        perPage: 8,
      })
    })

    it('searches without filter_by for he_phai_secretary', async () => {
      verifyFirebaseAdminToken.mockResolvedValue({
        uid: 'sec-1',
        role: 'he_phai_secretary',
        orgUnitId: null,
      })
      const { handleSearchApi } = await import('./searchApi')

      await handleSearchApi(searchRequest({ q: 'phap' }, 'sec-token'), makeEnv())

      expect(multiSearch).toHaveBeenCalledWith({
        q: 'phap',
        perPage: 8,
      })
    })

    it('includes filter_by with orgUnitId for giao_doan_admin', async () => {
      verifyFirebaseAdminToken.mockResolvedValue({
        uid: 'gd-admin',
        role: 'giao_doan_admin',
        orgUnitId: 'gd-ii',
      })
      const { handleSearchApi } = await import('./searchApi')

      await handleSearchApi(searchRequest({ q: 'phap' }, 'gd-token'), makeEnv())

      expect(multiSearch).toHaveBeenCalledWith({
        q: 'phap',
        perPage: 8,
        filterBy: 'orgUnitId:=gd-ii',
      })
    })

    it('returns 403 when giao_doan_admin is missing orgUnitId', async () => {
      verifyFirebaseAdminToken.mockResolvedValue({
        uid: 'gd-admin',
        role: 'giao_doan_admin',
        orgUnitId: null,
      })
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        searchRequest({ q: 'phap' }, 'gd-token'),
        makeEnv(),
      )

      expect(response!.status).toBe(403)
      expect(multiSearch).not.toHaveBeenCalled()
    })
  })

  it('no longer serves the client-driven upsert and delete routes', async () => {
    const { handleSearchApi } = await import('./searchApi')

    for (const path of ['/api/search/upsert', '/api/search/delete']) {
      const response = await handleSearchApi(
        new Request(`https://example.com${path}`, { method: 'POST', body: '{}' }),
        makeEnv(),
      )
      expect(response!.status).toBe(404)
    }
  })

  describe('POST /api/search/reindex', () => {
    function reindexRequest(body: object, token?: string): Request {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      return new Request('https://example.com/api/search/reindex', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
    }

    it('ensure phase calls recreateCollections for he_phai_admin', async () => {
      verifyHePhaiAdminToken.mockResolvedValue({ uid: 'hp-admin' })
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        reindexRequest({ phase: 'ensure' }, 'hp-token'),
        makeEnv(),
      )
      const body = await response!.json()

      expect(response!.status).toBe(200)
      expect(body).toEqual({ ok: true })
      expect(recreateCollections).toHaveBeenCalled()
      expect(ensureCollections).not.toHaveBeenCalled()
    })

    it('import-from-db imports one page read from D1 and returns its cursor', async () => {
      verifyHePhaiAdminToken.mockResolvedValue({ uid: 'hp-admin' })
      const bind = vi.fn(() => ({ all: async () => ({ results: [] }) }))
      const prepare = vi.fn(() => ({ bind }))
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        reindexRequest({ phase: 'import-from-db', collection: 'temples', cursor: 't-9' }, 'hp-token'),
        makeEnv({ DB: { prepare } as unknown as D1Database }),
      )

      expect(response!.status).toBe(200)
      expect(await response!.json()).toEqual({ ok: true, imported: 0, nextCursor: null })
      expect(prepare.mock.calls[0]![0]).toContain('FROM temples')
      expect(bind).toHaveBeenCalledWith('t-9', expect.any(Number))
      expect(importDocuments).not.toHaveBeenCalled()
    })

    it('import-from-db refuses an unknown collection', async () => {
      verifyHePhaiAdminToken.mockResolvedValue({ uid: 'hp-admin' })
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        reindexRequest({ phase: 'import-from-db', collection: 'users' }, 'hp-token'),
        makeEnv(),
      )

      expect(response!.status).toBe(400)
    })

    it('refuses a phase that is not ensure or import-from-db', async () => {
      verifyHePhaiAdminToken.mockResolvedValue({ uid: 'hp-admin' })
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        reindexRequest({ phase: 'import', collection: 'members', documents: [sampleMember] }, 'hp-token'),
        makeEnv(),
      )

      expect(response!.status).toBe(400)
      expect(importDocuments).not.toHaveBeenCalled()
    })

    it('returns 403 for secretary', async () => {
      verifyHePhaiAdminToken.mockResolvedValue(null)
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        reindexRequest({ phase: 'ensure' }, 'sec-token'),
        makeEnv(),
      )

      expect(response!.status).toBe(403)
      expect(recreateCollections).not.toHaveBeenCalled()
      expect(ensureCollections).not.toHaveBeenCalled()
    })

    it('returns 401 without token', async () => {
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        reindexRequest({ phase: 'ensure' }),
        makeEnv(),
      )

      expect(response!.status).toBe(401)
    })
  })
})
