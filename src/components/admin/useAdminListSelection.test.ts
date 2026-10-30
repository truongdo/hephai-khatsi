import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAdminListSelection } from './useAdminListSelection'

describe('useAdminListSelection', () => {
  it('toggles individual ids', () => {
    const { result } = renderHook(() => useAdminListSelection(['a', 'b', 'c']))

    act(() => {
      result.current.toggle('a')
    })
    expect(result.current.selectedIds.has('a')).toBe(true)
    expect(result.current.selectedCount).toBe(1)

    act(() => {
      result.current.toggle('a')
    })
    expect(result.current.selectedIds.has('a')).toBe(false)
    expect(result.current.selectedCount).toBe(0)
  })

  it('selects all loaded ids with toggleAllLoaded', () => {
    const { result } = renderHook(() => useAdminListSelection(['a', 'b']))

    act(() => {
      result.current.toggleAllLoaded()
    })
    expect(result.current.allLoadedSelected).toBe(true)
    expect(result.current.selectedCount).toBe(2)
    expect(result.current.someSelected).toBe(false)
  })

  it('clears loaded selection with toggleAllLoaded when all are selected', () => {
    const { result } = renderHook(() => useAdminListSelection(['a', 'b']))

    act(() => {
      result.current.toggleAllLoaded()
    })
    act(() => {
      result.current.toggleAllLoaded()
    })
    expect(result.current.selectedCount).toBe(0)
    expect(result.current.allLoadedSelected).toBe(false)
  })

  it('reports someSelected when only part of loaded rows are selected', () => {
    const { result } = renderHook(() => useAdminListSelection(['a', 'b', 'c']))

    act(() => {
      result.current.toggle('b')
    })
    expect(result.current.someSelected).toBe(true)
    expect(result.current.allLoadedSelected).toBe(false)
  })

  it('clears selection explicitly', () => {
    const { result } = renderHook(() => useAdminListSelection(['a', 'b']))

    act(() => {
      result.current.toggleAllLoaded()
      result.current.clear()
    })
    expect(result.current.selectedCount).toBe(0)
  })

  it('clears selection when loaded item ids change', () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useAdminListSelection(ids),
      { initialProps: { ids: ['a', 'b'] } },
    )

    act(() => {
      result.current.toggle('a')
    })
    expect(result.current.selectedCount).toBe(1)

    rerender({ ids: ['a', 'b', 'c'] })
    expect(result.current.selectedCount).toBe(0)
  })

  it('clears selection when item ids list changes', () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useAdminListSelection(ids),
      { initialProps: { ids: ['a', 'b', 'c'] } },
    )

    act(() => {
      result.current.toggle('a')
      result.current.toggle('c')
    })

    rerender({ ids: ['a', 'c'] })
    expect(result.current.selectedCount).toBe(0)
  })
})
