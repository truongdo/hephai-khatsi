import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MemberSearchDoc, TempleSearchDoc } from '#/domain/searchDocs'
import {
  deleteSearchDocument,
  reindexEnsure,
  reindexImport,
  reindexImportFromDb,
  searchDirectory,
  upsertSearchDocument,
} from './searchApiClient'

const fetchMock = vi.fn()

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

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchDirectory', () => {
  it('POSTs to /api/search with query and admin token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ members: [sampleMember], temples: [sampleTemple] }),
    })

    const result = await searchDirectory({ q: 'nguyen', idToken: 'admin-token' })

    expect(result).toEqual({
      members: [sampleMember],
      temples: [sampleTemple],
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({ q: 'nguyen' }),
    })
  })

  it('throws when the API response is not ok', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    })

    await expect(
      searchDirectory({ q: 'test', idToken: 'bad' }),
    ).rejects.toThrow(/Forbidden/)
  })
})

describe('upsertSearchDocument', () => {
  it('POSTs to /api/search/upsert with invite token in body', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

    await upsertSearchDocument({
      collection: 'members',
      document: sampleMember,
      inviteToken: 'invite-token',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/search/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection: 'members',
        document: sampleMember,
        inviteToken: 'invite-token',
      }),
    })
  })

  it('POSTs with Authorization when idToken is provided', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

    await upsertSearchDocument({
      collection: 'temples',
      document: sampleTemple,
      idToken: 'admin-token',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/search/upsert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        collection: 'temples',
        document: sampleTemple,
      }),
    })
  })

  it('throws when upsert fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    })

    await expect(
      upsertSearchDocument({
        collection: 'members',
        document: sampleMember,
        inviteToken: 'bad',
      }),
    ).rejects.toThrow(/Unauthorized/)
  })
})

describe('deleteSearchDocument', () => {
  it('POSTs to /api/search/delete with admin token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

    await deleteSearchDocument({
      collection: 'members',
      id: 'm1',
      idToken: 'admin-token',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/search/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({ collection: 'members', id: 'm1' }),
    })
  })
})

describe('reindexEnsure', () => {
  it('POSTs ensure phase to /api/search/reindex', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

    await reindexEnsure({ idToken: 'he-phai-token' })

    expect(fetchMock).toHaveBeenCalledWith('/api/search/reindex', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer he-phai-token',
      },
      body: JSON.stringify({ phase: 'ensure' }),
    })
  })
})

describe('reindexImport', () => {
  it('POSTs import phase with collection and documents', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, imported: 2 }),
    })

    const documents = [sampleMember, { ...sampleMember, id: 'm2' }]
    const result = await reindexImport({
      idToken: 'he-phai-token',
      collection: 'members',
      documents,
    })

    expect(result).toEqual({ imported: 2 })
    expect(fetchMock).toHaveBeenCalledWith('/api/search/reindex', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer he-phai-token',
      },
      body: JSON.stringify({
        phase: 'import',
        collection: 'members',
        documents,
      }),
    })
  })
})

describe('reindexImportFromDb', () => {
  it('POSTs import-from-db phase with the cursor of the previous page', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, imported: 250, nextCursor: 'm250' }),
    })

    const result = await reindexImportFromDb({
      idToken: 'he-phai-token',
      collection: 'members',
      cursor: 'm0',
    })

    expect(result).toEqual({ imported: 250, nextCursor: 'm250' })
    expect(fetchMock).toHaveBeenCalledWith('/api/search/reindex', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer he-phai-token',
      },
      body: JSON.stringify({ phase: 'import-from-db', collection: 'members', cursor: 'm0' }),
    })
  })

  it('omits the cursor on the first page', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, imported: 3, nextCursor: null }),
    })

    await reindexImportFromDb({ idToken: 'he-phai-token', collection: 'temples', cursor: null })

    expect(fetchMock.mock.calls[0]![1].body).toBe(
      JSON.stringify({ phase: 'import-from-db', collection: 'temples' }),
    )
  })

  it('throws the API error when the Worker refuses the phase', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid phase' }),
    })

    await expect(
      reindexImportFromDb({ idToken: 'he-phai-token', collection: 'members', cursor: null }),
    ).rejects.toThrow('Invalid phase')
  })
})
