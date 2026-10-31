import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reindexEnsure, reindexImportFromDb } from '#/search/searchApiClient'
import { reindexDirectorySearch } from '#/search/reindexDirectory'

vi.mock('#/search/searchApiClient', () => ({
  reindexEnsure: vi.fn(),
  reindexImportFromDb: vi.fn(),
}))

const reindexEnsureMock = vi.mocked(reindexEnsure)
const reindexImportFromDbMock = vi.mocked(reindexImportFromDb)

beforeEach(() => {
  reindexEnsureMock.mockReset()
  reindexEnsureMock.mockResolvedValue(undefined)
  reindexImportFromDbMock.mockReset()
})

describe('reindexDirectorySearch', () => {
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

    const result = await reindexDirectorySearch({ idToken: 'token-1' })

    expect(reindexEnsureMock).toHaveBeenCalledWith({ idToken: 'token-1' })
    expect(reindexEnsureMock.mock.invocationCallOrder[0]).toBeLessThan(
      reindexImportFromDbMock.mock.invocationCallOrder[0]!,
    )
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

    await expect(reindexDirectorySearch({ idToken: 'token-1' })).rejects.toThrow('Forbidden')
    expect(reindexImportFromDbMock).not.toHaveBeenCalled()
  })
})
