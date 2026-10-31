import { describe, expect, it, vi } from 'vitest'
import { chunk, collectPages } from './paging'

describe('chunk', () => {
  it('splits into slices of at most size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 2)).toEqual([])
  })
})

describe('collectPages', () => {
  it('follows nextCursor until the last page', async () => {
    const loadPage = vi.fn(async (cursor: string | undefined) =>
      cursor === undefined
        ? { items: ['a', 'b'], nextCursor: 'c1' }
        : { items: ['c'], nextCursor: null },
    )
    expect(await collectPages(loadPage)).toEqual(['a', 'b', 'c'])
    expect(loadPage.mock.calls).toEqual([[undefined], ['c1']])
  })
})
