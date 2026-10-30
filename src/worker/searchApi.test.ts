// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TYPESENSE_MEMBERS_COLLECTION,
  TYPESENSE_TEMPLES_COLLECTION,
  type MemberSearchDoc,
  type TempleSearchDoc,
} from '#/domain/searchDocs'
import type { Env } from './env'

const verifyFirebaseAdminToken = vi.fn()
const verifyHePhaiAdminToken = vi.fn()
const inviteExists = vi.fn()
const ensureCollections = vi.fn()
const recreateCollections = vi.fn()
const multiSearch = vi.fn()
const upsert = vi.fn()
const deleteDocument = vi.fn()
const importDocuments = vi.fn()

vi.mock('./verifyFirebaseAdmin', () => ({
  verifyFirebaseAdminToken,
  verifyHePhaiAdminToken,
}))

vi.mock('./firestoreRest', () => ({
  inviteExists,
}))

vi.mock('./typesenseClient', () => ({
  createTypesenseClient: () => ({
    ensureCollections,
    recreateCollections,
    multiSearch,
    upsert,
    deleteDocument,
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
  upsert.mockResolvedValue(undefined)
  deleteDocument.mockResolvedValue(undefined)
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

  describe('POST /api/search/upsert', () => {
    function upsertRequest(body: object, token?: string): Request {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      return new Request('https://example.com/api/search/upsert', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
    }

    it('upserts with admin bearer auth', async () => {
      verifyFirebaseAdminToken.mockResolvedValue({
        uid: 'admin-1',
        role: 'he_phai_admin',
        orgUnitId: null,
      })
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        upsertRequest({ collection: 'members', document: sampleMember }, 'admin-token'),
        makeEnv(),
      )
      const body = await response!.json()

      expect(response!.status).toBe(200)
      expect(body).toEqual({ ok: true })
      expect(upsert).toHaveBeenCalledWith(TYPESENSE_MEMBERS_COLLECTION, sampleMember)
    })

    it('upserts with inviteToken when inviteExists is true', async () => {
      inviteExists.mockResolvedValue(true)
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        upsertRequest({
          collection: 'temples',
          document: sampleTemple,
          inviteToken: 'invite-1',
        }),
        makeEnv(),
      )

      expect(response!.status).toBe(200)
      expect(verifyFirebaseAdminToken).not.toHaveBeenCalled()
      expect(inviteExists).toHaveBeenCalledWith(PROJECT_ID, 'invite-1')
      expect(upsert).toHaveBeenCalledWith(TYPESENSE_TEMPLES_COLLECTION, sampleTemple)
    })

    it('returns 401 when neither admin nor valid invite', async () => {
      inviteExists.mockResolvedValue(false)
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        upsertRequest({
          collection: 'members',
          document: sampleMember,
          inviteToken: 'bad-invite',
        }),
        makeEnv(),
      )

      expect(response!.status).toBe(401)
      expect(upsert).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/search/delete', () => {
    function deleteRequest(body: object, token?: string): Request {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      return new Request('https://example.com/api/search/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
    }

    it('returns 401 without admin token', async () => {
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        deleteRequest({ collection: 'members', id: 'm1' }),
        makeEnv(),
      )

      expect(response!.status).toBe(401)
      expect(deleteDocument).not.toHaveBeenCalled()
    })

    it('deletes document for directory admin', async () => {
      verifyFirebaseAdminToken.mockResolvedValue({
        uid: 'admin-1',
        role: 'he_phai_admin',
        orgUnitId: null,
      })
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        deleteRequest({ collection: 'temples', id: 't1' }, 'admin-token'),
        makeEnv(),
      )
      const body = await response!.json()

      expect(response!.status).toBe(200)
      expect(body).toEqual({ ok: true })
      expect(deleteDocument).toHaveBeenCalledWith(TYPESENSE_TEMPLES_COLLECTION, 't1')
    })

    it('returns 403 when verify returns null', async () => {
      verifyFirebaseAdminToken.mockResolvedValue(null)
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        deleteRequest({ collection: 'members', id: 'm1' }, 'bad-token'),
        makeEnv(),
      )

      expect(response!.status).toBe(403)
      expect(deleteDocument).not.toHaveBeenCalled()
    })
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

    it('import phase calls importDocuments and returns count', async () => {
      verifyHePhaiAdminToken.mockResolvedValue({ uid: 'hp-admin' })
      const docs = [sampleMember, { ...sampleMember, id: 'm2' }]
      const { handleSearchApi } = await import('./searchApi')

      const response = await handleSearchApi(
        reindexRequest({ phase: 'import', collection: 'members', documents: docs }, 'hp-token'),
        makeEnv(),
      )
      const body = await response!.json()

      expect(response!.status).toBe(200)
      expect(body).toEqual({ ok: true, imported: 2 })
      expect(importDocuments).toHaveBeenCalledWith(TYPESENSE_MEMBERS_COLLECTION, docs)
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
