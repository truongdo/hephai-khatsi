import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearFormLocalDraft,
  readFormLocalDraft,
  serializeDraftFields,
  writeFormLocalDraft,
} from '#/lib/formLocalDraft'
import { useFormLocalDraft } from './useFormLocalDraft'

vi.mock('#/lib/formLocalDraft', () => ({
  readFormLocalDraft: vi.fn(),
  writeFormLocalDraft: vi.fn(),
  clearFormLocalDraft: vi.fn(),
  serializeDraftFields: vi.fn((fields: Record<string, unknown>) => fields),
}))

const readMock = vi.mocked(readFormLocalDraft)
const writeMock = vi.mocked(writeFormLocalDraft)
const clearMock = vi.mocked(clearFormLocalDraft)
const serializeMock = vi.mocked(serializeDraftFields)

describe('useFormLocalDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    readMock.mockReturnValue(null)
    serializeMock.mockImplementation((fields) => fields)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('does not read storage when disabled', () => {
    renderHook(() =>
      useFormLocalDraft({
        storageKey: 'formDraft:member:m1',
        enabled: false,
      }),
    )

    expect(readMock).not.toHaveBeenCalled()
  })

  it('restores draft on mount when enabled', () => {
    const onRestore = vi.fn()
    readMock.mockReturnValue({
      version: 1,
      updatedAt: '2026-08-04T12:00:00.000Z',
      fields: { name: 'Ananda' },
    })

    const { result } = renderHook(() =>
      useFormLocalDraft<{ name: string }>({
        storageKey: 'formDraft:member:m1',
        enabled: true,
        onRestore,
      }),
    )

    expect(readMock).toHaveBeenCalledWith('formDraft:member:m1')
    expect(onRestore).toHaveBeenCalledOnce()
    expect(onRestore).toHaveBeenCalledWith({ name: 'Ananda' })
    expect(result.current.restored).toBe(true)
  })

  it('leaves restored false when no draft exists', () => {
    const onRestore = vi.fn()

    const { result } = renderHook(() =>
      useFormLocalDraft({
        storageKey: 'formDraft:member:m1',
        enabled: true,
        onRestore,
      }),
    )

    expect(onRestore).not.toHaveBeenCalled()
    expect(result.current.restored).toBe(false)
  })

  it('clears local draft and skips restore when hasServerData', () => {
    const onRestore = vi.fn()
    readMock.mockReturnValue({
      version: 1,
      updatedAt: '2026-08-04T14:00:00.000Z',
      fields: { name: 'Local only' },
    })

    const { result } = renderHook(() =>
      useFormLocalDraft<{ name: string }>({
        storageKey: 'formDraft:temple:t1',
        enabled: true,
        hasServerData: true,
        onRestore,
      }),
    )

    expect(onRestore).not.toHaveBeenCalled()
    expect(clearMock).toHaveBeenCalledWith('formDraft:temple:t1')
    expect(result.current.restored).toBe(false)
  })

  it('does not persist when hasServerData', () => {
    const { result } = renderHook(() =>
      useFormLocalDraft({
        storageKey: 'formDraft:temple:t1',
        enabled: true,
        hasServerData: true,
      }),
    )

    act(() => {
      result.current.persist({ name: 'A' })
      vi.advanceTimersByTime(500)
    })

    expect(writeMock).not.toHaveBeenCalled()
  })

  it('restores local draft when there is no server data', () => {
    const onRestore = vi.fn()
    readMock.mockReturnValue({
      version: 1,
      updatedAt: '2026-08-04T14:00:00.000Z',
      fields: { name: 'Create draft' },
    })

    const { result } = renderHook(() =>
      useFormLocalDraft<{ name: string }>({
        storageKey: 'formDraft:temple:new:gd-i:admin',
        enabled: true,
        hasServerData: false,
        onRestore,
      }),
    )

    expect(onRestore).toHaveBeenCalledWith({ name: 'Create draft' })
    expect(clearMock).not.toHaveBeenCalled()
    expect(result.current.restored).toBe(true)
  })

  it('debounces persist writes with default 400ms', () => {
    const { result } = renderHook(() =>
      useFormLocalDraft({
        storageKey: 'formDraft:member:m1',
        enabled: true,
      }),
    )

    act(() => {
      result.current.persist({ name: 'A' })
      result.current.persist({ name: 'B' })
    })

    expect(writeMock).not.toHaveBeenCalled()
    expect(serializeMock).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(399)
    })
    expect(writeMock).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(serializeMock).toHaveBeenCalledWith({ name: 'B' })
    expect(writeMock).toHaveBeenCalledOnce()
    expect(writeMock).toHaveBeenCalledWith('formDraft:member:m1', { name: 'B' })
  })

  it('respects custom debounceMs', () => {
    const { result } = renderHook(() =>
      useFormLocalDraft({
        storageKey: 'formDraft:temple:t1',
        enabled: true,
        debounceMs: 200,
      }),
    )

    act(() => {
      result.current.persist({ title: 'Chùa A' })
    })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(writeMock).toHaveBeenCalledWith('formDraft:temple:t1', {
      title: 'Chùa A',
    })
  })

  it('does not persist when disabled', () => {
    const { result } = renderHook(() =>
      useFormLocalDraft({
        storageKey: 'formDraft:member:m1',
        enabled: false,
      }),
    )

    act(() => {
      result.current.persist({ name: 'A' })
      vi.advanceTimersByTime(500)
    })

    expect(writeMock).not.toHaveBeenCalled()
  })

  it('clears pending debounce and storage when enabled', () => {
    const { result } = renderHook(() =>
      useFormLocalDraft({
        storageKey: 'formDraft:member:m1',
        enabled: true,
      }),
    )

    act(() => {
      result.current.persist({ name: 'A' })
    })

    act(() => {
      result.current.clear()
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(writeMock).not.toHaveBeenCalled()
    expect(clearMock).toHaveBeenCalledWith('formDraft:member:m1')
  })

  it('cancels debounce but skips storage clear when disabled', () => {
    const { result } = renderHook(() =>
      useFormLocalDraft({
        storageKey: 'formDraft:member:m1',
        enabled: false,
      }),
    )

    act(() => {
      result.current.persist({ name: 'A' })
      result.current.clear()
      vi.advanceTimersByTime(500)
    })

    expect(writeMock).not.toHaveBeenCalled()
    expect(clearMock).not.toHaveBeenCalled()
  })
})
