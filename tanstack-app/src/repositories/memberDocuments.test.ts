import { describe, expect, it } from 'vitest'
import {
  mergeDocumentPath,
  removeDocumentSide,
  type DocumentTypeId,
} from '#/domain/memberDocumentTypes'
import { createMemoryMemberStore } from '#/test/memoryStores'

describe('setDocumentPaths', () => {
  it('writes documents map on member', async () => {
    const store = createMemoryMemberStore()
    const { member } = await store.createOrUpdateDraft({
      orgUnitId: 'gd1',
      sanghaType: 'tang',
      inviteId: null,
      cccd: '012345678901',
      patch: {},
    })
    const updated = await store.setDocumentPaths(member.id, {
      cccd: { frontPath: 'members/x/docs/cccd/front.jpg' },
    })
    expect(updated.documents?.cccd?.frontPath).toContain('front.jpg')
    expect((await store.getById(member.id))?.documents?.cccd?.frontPath).toBe(
      updated.documents?.cccd?.frontPath,
    )
  })
})

describe('mergeDocumentSide', () => {
  it('merges one side without overwriting other sides', async () => {
    const store = createMemoryMemberStore()
    const { member } = await store.createOrUpdateDraft({
      orgUnitId: 'gd1',
      sanghaType: 'tang',
      inviteId: null,
      cccd: '012345678901',
      patch: {},
    })

    await store.mergeDocumentSide(
      member.id,
      'cccd',
      'front',
      'members/x/docs/cccd/front.jpg',
    )
    const { member: updated, previousPath } = await store.mergeDocumentSide(
      member.id,
      'cccd',
      'back',
      'members/x/docs/cccd/back.jpg',
    )

    expect(previousPath).toBeUndefined()
    expect(updated.documents).toEqual({
      cccd: {
        frontPath: 'members/x/docs/cccd/front.jpg',
        backPath: 'members/x/docs/cccd/back.jpg',
      },
    })
  })

  it('returns previous path when replacing a side', async () => {
    const store = createMemoryMemberStore()
    const { member } = await store.createOrUpdateDraft({
      orgUnitId: 'gd1',
      sanghaType: 'tang',
      inviteId: null,
      cccd: '012345678901',
      patch: {},
    })
    const oldPath = 'members/x/docs/cccd/front-old.jpg'

    await store.mergeDocumentSide(member.id, 'cccd', 'front', oldPath)
    const { previousPath } = await store.mergeDocumentSide(
      member.id,
      'cccd',
      'front',
      'members/x/docs/cccd/front-new.jpg',
    )

    expect(previousPath).toBe(oldPath)
  })
})

describe('removeDocumentPaths', () => {
  it('removes one side from latest server state', async () => {
    const store = createMemoryMemberStore()
    const { member } = await store.createOrUpdateDraft({
      orgUnitId: 'gd1',
      sanghaType: 'tang',
      inviteId: null,
      cccd: '012345678901',
      patch: {},
    })
    await store.setDocumentPaths(member.id, {
      cccd: {
        frontPath: 'members/x/docs/cccd/front.jpg',
        backPath: 'members/x/docs/cccd/back.jpg',
      },
    })

    const { member: updated, removedPaths } = await store.removeDocumentPaths(
      member.id,
      'cccd',
      'front',
    )

    expect(removedPaths).toEqual(['members/x/docs/cccd/front.jpg'])
    expect(updated.documents).toEqual({
      cccd: { backPath: 'members/x/docs/cccd/back.jpg' },
    })
  })
})

describe('document path helpers', () => {
  it('mergeDocumentPath preserves unrelated types', () => {
    const current = {
      cccd: { frontPath: 'a/front.jpg' },
      diep_sa_di: { filePath: 'a/file.pdf' },
    } satisfies Partial<Record<DocumentTypeId, { frontPath?: string; filePath?: string }>>

    const merged = mergeDocumentPath(current, 'cccd', 'back', 'a/back.jpg')
    expect(merged).toEqual({
      cccd: { frontPath: 'a/front.jpg', backPath: 'a/back.jpg' },
      diep_sa_di: { filePath: 'a/file.pdf' },
    })
  })

  it('removeDocumentSide drops empty type entries', () => {
    const current = { cccd: { frontPath: 'a/front.jpg' } }
    expect(removeDocumentSide(current, 'cccd', 'front')).toEqual({})
  })
})
