import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The client notifies Typesense itself only on Firestore; pin it whatever
// VITE_DATA_BACKEND is (the D1 case is below).
vi.mock('#/data/dataBackend', () => ({ DATA_BACKEND: 'firestore' }))
import type { Member, Temple } from '#/domain/types'
import * as searchApiClient from './searchApiClient'
import {
  notifyMemberDelete,
  notifyMemberUpsert,
  notifyTempleDelete,
  notifyTempleUpsert,
} from './notifySearchIndex'

let upsertSearchDocument: ReturnType<typeof vi.spyOn>
let deleteSearchDocument: ReturnType<typeof vi.spyOn>

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    status: 'draft',
    cccd: '012345678901',
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

function temple(overrides: Partial<Temple> = {}): Temple {
  return {
    id: 't1',
    orgUnitId: 'gd-i',
    status: 'locked',
    managerPhones: ['0901234567'],
    inviteId: null,
    photoPath: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

beforeEach(() => {
  upsertSearchDocument = vi.spyOn(searchApiClient, 'upsertSearchDocument')
  deleteSearchDocument = vi.spyOn(searchApiClient, 'deleteSearchDocument')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('notifyMemberUpsert', () => {
  it('maps member and upserts with auth', async () => {
    upsertSearchDocument.mockResolvedValueOnce(undefined)

    await notifyMemberUpsert(
      member({ phapDanh: 'Thích A', dienThoai: '090-123-4567' }),
      { idToken: 'admin-token' },
    )

    expect(upsertSearchDocument).toHaveBeenCalledWith({
      collection: 'members',
      document: expect.objectContaining({
        id: 'm1',
        phapDanh: 'Thích A',
        dienThoai: '0901234567',
      }),
      idToken: 'admin-token',
    })
  })

  it('resolves without throwing when upsert fails', async () => {
    upsertSearchDocument.mockRejectedValueOnce(new Error('Network error'))

    await expect(
      notifyMemberUpsert(member(), { inviteToken: 'invite-1' }),
    ).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalled()
  })
})

describe('notifyTempleUpsert', () => {
  it('maps temple and upserts with invite token', async () => {
    upsertSearchDocument.mockResolvedValueOnce(undefined)

    await notifyTempleUpsert(
      temple({ danhHieu: 'TX A' }),
      { inviteToken: 'invite-1' },
    )

    expect(upsertSearchDocument).toHaveBeenCalledWith({
      collection: 'temples',
      document: expect.objectContaining({
        id: 't1',
        danhHieu: 'TX A',
      }),
      inviteToken: 'invite-1',
    })
  })

  it('resolves without throwing when upsert fails', async () => {
    upsertSearchDocument.mockRejectedValueOnce(new Error('Unauthorized'))

    await expect(
      notifyTempleUpsert(temple(), { idToken: 'bad' }),
    ).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalled()
  })
})

describe('notifyMemberDelete', () => {
  it('deletes member search doc by id', async () => {
    deleteSearchDocument.mockResolvedValueOnce(undefined)

    await notifyMemberDelete('m1', 'admin-token')

    expect(deleteSearchDocument).toHaveBeenCalledWith({
      collection: 'members',
      id: 'm1',
      idToken: 'admin-token',
    })
  })

  it('resolves without throwing when delete fails', async () => {
    deleteSearchDocument.mockRejectedValueOnce(new Error('Forbidden'))

    await expect(notifyMemberDelete('m1', 'bad')).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalled()
  })
})

describe('notifyTempleDelete', () => {
  it('deletes temple search doc by id', async () => {
    deleteSearchDocument.mockResolvedValueOnce(undefined)

    await notifyTempleDelete('t1', 'admin-token')

    expect(deleteSearchDocument).toHaveBeenCalledWith({
      collection: 'temples',
      id: 't1',
      idToken: 'admin-token',
    })
  })

  it('resolves without throwing when delete fails', async () => {
    deleteSearchDocument.mockRejectedValueOnce(new Error('Forbidden'))

    await expect(notifyTempleDelete('t1', 'bad')).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalled()
  })
})

describe('with the D1 backend', () => {
  afterEach(() => {
    vi.doUnmock('#/data/dataBackend')
    vi.resetModules()
  })

  it('sends nothing: the Worker syncs Typesense after its writes', async () => {
    vi.doMock('#/data/dataBackend', () => ({ DATA_BACKEND: 'd1' }))
    vi.resetModules()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const notify = await import('./notifySearchIndex')

    await notify.notifyMemberUpsert(member(), { idToken: 'token' })
    await notify.notifyTempleUpsert(temple(), { inviteToken: 'public' })
    await notify.notifyMemberDelete('m1', 'token')
    await notify.notifyTempleDelete('t1', 'token')

    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
