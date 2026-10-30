import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FORM_LOCAL_DRAFT_VERSION,
  clearFormLocalDraft,
  memberDraftStorageKey,
  readFormLocalDraft,
  serializeDraftFields,
  templeDraftStorageKey,
  writeFormLocalDraft,
} from './formLocalDraft'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('memberDraftStorageKey', () => {
  it('builds new member key', () => {
    expect(
      memberDraftStorageKey({
        kind: 'new',
        orgUnitId: 'ou1',
        sanghaType: 'bhikkhu',
        actorId: 'user1',
      }),
    ).toBe('formDraft:member:new:ou1:bhikkhu:user1')
  })

  it('builds existing member key', () => {
    expect(
      memberDraftStorageKey({ kind: 'existing', memberId: 'm1' }),
    ).toBe('formDraft:member:m1')
  })
})

describe('templeDraftStorageKey', () => {
  it('builds new temple key', () => {
    expect(
      templeDraftStorageKey({
        kind: 'new',
        orgUnitId: 'ou1',
        actorId: 'user1',
      }),
    ).toBe('formDraft:temple:new:ou1:user1')
  })

  it('builds existing temple key', () => {
    expect(
      templeDraftStorageKey({ kind: 'existing', templeId: 't1' }),
    ).toBe('formDraft:temple:t1')
  })
})

describe('serializeDraftFields', () => {
  it('strips File, Blob, and undefined values', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
    const blob = new Blob(['y'])
    const input = {
      name: 'Temple A',
      photo: file,
      attachment: blob,
      notes: undefined,
      count: 3,
    }

    expect(serializeDraftFields(input)).toEqual({ name: 'Temple A', count: 3 })
  })
})

describe('writeFormLocalDraft / readFormLocalDraft', () => {
  it('round-trips fields through localStorage', () => {
    const key = 'formDraft:member:m1'
    const now = '2026-08-04T12:00:00.000Z'

    writeFormLocalDraft(key, { name: 'Ananda', age: 30 }, now)

    expect(readFormLocalDraft<{ name: string; age: number }>(key)).toEqual({
      version: FORM_LOCAL_DRAFT_VERSION,
      updatedAt: now,
      fields: { name: 'Ananda', age: 30 },
    })
  })

  it('returns null for missing key', () => {
    expect(readFormLocalDraft('formDraft:member:missing')).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    localStorage.setItem('formDraft:member:bad', '{not json')
    expect(readFormLocalDraft('formDraft:member:bad')).toBeNull()
  })

  it('strips File values on write', () => {
    const key = 'formDraft:temple:t1'
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })

    writeFormLocalDraft(key, { title: 'Chùa A', photo: file })

    expect(readFormLocalDraft<{ title: string }>(key)).toEqual({
      version: FORM_LOCAL_DRAFT_VERSION,
      updatedAt: expect.any(String),
      fields: { title: 'Chùa A' },
    })
  })
})

describe('clearFormLocalDraft', () => {
  it('removes the draft key', () => {
    const key = 'formDraft:member:m1'
    writeFormLocalDraft(key, { name: 'Ananda' })
    expect(localStorage.getItem(key)).not.toBeNull()

    clearFormLocalDraft(key)

    expect(localStorage.getItem(key)).toBeNull()
    expect(readFormLocalDraft(key)).toBeNull()
  })
})

describe('writeFormLocalDraft quota errors', () => {
  it('swallows QuotaExceededError from setItem', () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      })

    expect(() =>
      writeFormLocalDraft('formDraft:member:m1', { name: 'Ananda' }),
    ).not.toThrow()

    setItemSpy.mockRestore()
  })
})
