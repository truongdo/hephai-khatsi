import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Member, Temple } from '#/domain/types'
import { reindexEnsure, reindexImport, reindexImportFromDb } from '#/search/searchApiClient'
import { reindexDirectorySearch, reindexDirectorySearchFromDb } from '#/search/reindexDirectory'

vi.mock('#/search/searchApiClient', () => ({
  reindexEnsure: vi.fn(),
  reindexImport: vi.fn(),
  reindexImportFromDb: vi.fn(),
}))

const reindexEnsureMock = vi.mocked(reindexEnsure)
const reindexImportMock = vi.mocked(reindexImport)
const reindexImportFromDbMock = vi.mocked(reindexImportFromDb)

function member(id: string, sanghaType: 'tang' | 'ni'): Member {
  return {
    id,
    orgUnitId: 'gd-i',
    sanghaType,
    status: 'locked',
    cccd: '001099012345',
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    phapDanh: `Phap ${id}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
  }
}

function temple(id: string): Temple {
  return {
    id,
    orgUnitId: 'gd-i',
    status: 'locked',
    managerPhones: [],
    inviteId: null,
    photoPath: null,
    danhHieu: `Temple ${id}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
  }
}

beforeEach(() => {
  reindexEnsureMock.mockReset()
  reindexImportMock.mockReset()
  reindexEnsureMock.mockResolvedValue(undefined)
  reindexImportMock.mockResolvedValue({ imported: 0 })
  reindexImportFromDbMock.mockReset()
})

describe('reindexDirectorySearch', () => {
  it('ensures collections, loads data, imports in batches, returns counts', async () => {
    const tangMembers = Array.from({ length: 25 }, (_, i) =>
      member(`tang-${i}`, 'tang'),
    )
    const niMembers = Array.from({ length: 20 }, (_, i) =>
      member(`ni-${i}`, 'ni'),
    )
    const temples = Array.from({ length: 5 }, (_, i) => temple(`t-${i}`))

    const listMembers = vi.fn(async ({ sanghaType }: { sanghaType: 'tang' | 'ni' }) =>
      sanghaType === 'tang' ? tangMembers : niMembers,
    )
    const listTemples = vi.fn(async () => temples)

    const result = await reindexDirectorySearch({
      idToken: 'token-1',
      listMembers,
      listTemples,
    })

    expect(reindexEnsureMock).toHaveBeenCalledWith({ idToken: 'token-1' })
    expect(listMembers).toHaveBeenCalledWith({ sanghaType: 'tang' })
    expect(listMembers).toHaveBeenCalledWith({ sanghaType: 'ni' })
    expect(listTemples).toHaveBeenCalled()

    const memberImports = reindexImportMock.mock.calls.filter(
      ([input]) => input.collection === 'members',
    )
    const templeImports = reindexImportMock.mock.calls.filter(
      ([input]) => input.collection === 'temples',
    )
    expect(memberImports).toHaveLength(2)
    expect(memberImports[0]![0].documents).toHaveLength(40)
    expect(memberImports[1]![0].documents).toHaveLength(5)
    expect(templeImports).toHaveLength(1)
    expect(templeImports[0]![0].documents).toHaveLength(5)

    expect(result).toEqual({ members: 45, temples: 5 })
  })
})

describe('reindexDirectorySearchFromDb', () => {
  it('ensures collections, then lets the Worker import every page of each collection', async () => {
    const pages: Record<string, Array<{ imported: number; nextCursor: string | null }>> = {
      members: [
        { imported: 250, nextCursor: 'm-250' },
        { imported: 250, nextCursor: 'm-500' },
        { imported: 11, nextCursor: null },
      ],
      temples: [{ imported: 176, nextCursor: null }],
    }
    reindexImportFromDbMock.mockImplementation(async ({ collection }) => pages[collection]!.shift()!)

    const result = await reindexDirectorySearchFromDb({ idToken: 'token-1' })

    expect(reindexEnsureMock).toHaveBeenCalledWith({ idToken: 'token-1' })
    expect(reindexImportFromDbMock.mock.calls.map(([input]) => [input.collection, input.cursor])).toEqual([
      ['members', null],
      ['members', 'm-250'],
      ['members', 'm-500'],
      ['temples', null],
    ])
    expect(result).toEqual({ members: 511, temples: 176 })
  })

  it('stops when ensuring the collections fails', async () => {
    reindexEnsureMock.mockRejectedValueOnce(new Error('Forbidden'))

    await expect(reindexDirectorySearchFromDb({ idToken: 'token-1' })).rejects.toThrow('Forbidden')
    expect(reindexImportFromDbMock).not.toHaveBeenCalled()
  })
})
