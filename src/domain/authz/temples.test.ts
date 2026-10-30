import { describe, expect, it } from 'vitest'
import { canCreateTemple, canDeleteTemple, canUpdateTemple } from './temples'
import {
  anon,
  gdAdmin,
  hePhaiAdmin,
  INVITE_ID,
  invites,
  legacyAdmin,
  patch,
  secretary,
  signedIn,
  templeDraft,
  templeLocked,
} from './testFixtures'

// Ported from firestoreRules.integration.test.ts (`temples`).

const seeded = invites()

const SAVE_AND_LOCK = {
  status: 'locked',
  lockedAt: '2026-01-02T00:00:00.000Z',
  lockedBy: 'filler',
  editRequestedAt: null,
  editRequestedBy: null,
  updatedAt: '2026-01-02T00:00:00.000Z',
}

describe('temples', () => {
  it('rejects filler create with draft status', () => {
    expect(canCreateTemple(anon, templeDraft(), seeded)).toBe(false)
    expect(canCreateTemple(anon, templeDraft({ id: 'temple-2', orgUnitId: 'gd-ii' }), seeded)).toBe(false)
  })

  it('allows filler create when status is locked by filler with null edit-request fields', () => {
    expect(canCreateTemple(anon, templeLocked(), seeded)).toBe(true)
    expect(canCreateTemple(anon, templeLocked({ id: 'temple-2', orgUnitId: 'gd-ii' }), seeded)).toBe(true)
  })

  it('rejects create with an invite id that does not exist', () => {
    expect(canCreateTemple(anon, templeDraft({ inviteId: 'does-not-exist' }), seeded)).toBe(false)
    expect(canCreateTemple(anon, templeLocked({ inviteId: 'does-not-exist' }), seeded)).toBe(false)
  })

  it('rejects create without manager phones', () => {
    expect(canCreateTemple(anon, templeLocked({ managerPhones: [] }), seeded)).toBe(false)
    expect(canCreateTemple(legacyAdmin, templeDraft({ inviteId: null, managerPhones: [] }), seeded)).toBe(false)
  })

  it('allows admin create of a draft without invite; denies staff filling as a visitor', () => {
    expect(canCreateTemple(legacyAdmin, templeDraft({ inviteId: null }), seeded)).toBe(true)
    expect(canCreateTemple(legacyAdmin, templeDraft(), seeded)).toBe(false)
    expect(canCreateTemple(legacyAdmin, templeLocked(), seeded)).toBe(false)
    expect(canCreateTemple(signedIn('someone'), templeLocked(), seeded)).toBe(true)
  })

  it('blocks filler profile updates on draft without locking', () => {
    const before = templeDraft()
    const after = patch(before, { danhHieu: 'Chua ABC', updatedAt: '2026-01-02T00:00:00.000Z' })
    expect(canUpdateTemple(anon, before, after, seeded)).toBe(false)
  })

  it('allows filler draft to locked save-and-lock with profile changes', () => {
    const before = templeDraft()
    const after = patch(before, { ...SAVE_AND_LOCK, danhHieu: 'Chua ABC' })
    expect(canUpdateTemple(anon, before, after, seeded)).toBe(true)
  })

  it('allows filler save-and-lock on an admin-created draft temple, adopting the invite', () => {
    const before = templeDraft({ inviteId: null })
    const after = patch(before, { ...SAVE_AND_LOCK, danhHieu: 'Chua ABC', inviteId: INVITE_ID })
    expect(canUpdateTemple(anon, before, after, seeded)).toBe(true)
  })

  it('denies filler adopting an admin-created draft temple without locking it', () => {
    const before = templeDraft({ inviteId: null })
    const after = patch(before, {
      photoPath: 'temples/x/photo.jpg',
      inviteId: INVITE_ID,
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    expect(canUpdateTemple(anon, before, after, seeded)).toBe(false)
  })

  it('denies filler replacing an existing invite on temple save-and-lock', () => {
    const before = templeDraft({ inviteId: 'other' })
    const after = patch(before, { ...SAVE_AND_LOCK, inviteId: INVITE_ID })
    expect(canUpdateTemple(anon, before, after, invites('other'))).toBe(false)
  })

  it('blocks filler profile updates on locked temples', () => {
    const before = templeLocked({ lockedAt: '2026-01-02T00:00:00.000Z' })
    expect(
      canUpdateTemple(anon, before, patch(before, { danhHieu: 'x', updatedAt: '2026-01-03T00:00:00.000Z' }), seeded),
    ).toBe(false)
    expect(canUpdateTemple(legacyAdmin, before, patch(before, { orgUnitId: 'gd-ii' }), seeded)).toBe(false)
  })

  it('allows filler edit-request and photoPath update on locked temple', () => {
    const before = templeLocked({ lockedAt: '2026-01-02T00:00:00.000Z', photoPath: null })
    const requested = patch(before, {
      editRequestedAt: '2026-01-03T00:00:00.000Z',
      editRequestedBy: '0912345678',
      updatedAt: '2026-01-03T00:00:00.000Z',
    })
    expect(canUpdateTemple(anon, before, requested, seeded)).toBe(true)
    const withPhoto = patch(requested, {
      photoPath: 'temples/temple-1/photo.jpg',
      updatedAt: '2026-01-04T00:00:00.000Z',
    })
    expect(canUpdateTemple(anon, requested, withPhoto, seeded)).toBe(true)
  })

  it('denies filler photoPath replace when locked temple already has a photo', () => {
    const before = templeLocked({
      lockedAt: '2026-01-02T00:00:00.000Z',
      photoPath: 'temples/temple-1/photo.jpg',
    })
    const after = patch(before, {
      photoPath: 'temples/temple-1/photo-replaced.jpg',
      updatedAt: '2026-01-04T00:00:00.000Z',
    })
    expect(canUpdateTemple(anon, before, after, seeded)).toBe(false)
  })

  it('allows filler to clear and replace photoPath on unlocked (draft) temple', () => {
    const withPhoto = templeDraft({ photoPath: 'temples/temple-1/photo.jpg' })
    const cleared = patch(withPhoto, { photoPath: null, updatedAt: '2026-01-03T00:00:00.000Z' })
    expect(canUpdateTemple(anon, withPhoto, cleared, seeded)).toBe(true)
    const replaced = patch(cleared, {
      photoPath: 'temples/temple-1/photo-replaced.jpg',
      updatedAt: '2026-01-04T00:00:00.000Z',
    })
    expect(canUpdateTemple(anon, cleared, replaced, seeded)).toBe(true)
  })

  it('allows he_phai_admin to change orgUnitId on draft temple; blocks others', () => {
    const before = templeDraft()
    const moved = patch(before, { orgUnitId: 'gd-ii', updatedAt: '2026-01-03T00:00:00.000Z' })
    expect(canUpdateTemple(hePhaiAdmin, before, moved, seeded)).toBe(true)
    expect(canUpdateTemple(gdAdmin, before, moved, seeded)).toBe(false)
    expect(canUpdateTemple(secretary, before, moved, seeded)).toBe(false)
    expect(canUpdateTemple(anon, before, moved, seeded)).toBe(false)
  })

  it('allows admin to update profile fields on a locked temple without unlocking', () => {
    const before = templeDraft({
      status: 'locked',
      lockedAt: '2026-01-02T00:00:00.000Z',
      lockedBy: 'admin-uid',
      photoPath: null,
    })
    const after = patch(before, {
      danhHieu: 'Updated',
      photoPath: 'temples/temple-1/photo.jpg',
      updatedAt: '2026-01-03T00:00:00.000Z',
    })
    expect(canUpdateTemple(legacyAdmin, before, after, seeded)).toBe(true)
    // still cannot change org unit
    expect(canUpdateTemple(legacyAdmin, after, patch(after, { orgUnitId: 'gd-ii' }), seeded)).toBe(false)
    // anon still blocked
    expect(canUpdateTemple(anon, after, patch(after, { danhHieu: 'x' }), seeded)).toBe(false)
  })

  it('denies giao_doan_admin updating or deleting a temple of another org', () => {
    const before = templeDraft({ orgUnitId: 'gd-ii' })
    expect(canUpdateTemple(gdAdmin, before, patch(before, { danhHieu: 'x' }), seeded)).toBe(false)
    expect(canDeleteTemple(gdAdmin, before)).toBe(false)
    expect(canDeleteTemple(gdAdmin, templeDraft())).toBe(true)
  })

  it('allows admin delete but denies unauthenticated delete', () => {
    expect(canDeleteTemple(anon, templeDraft())).toBe(false)
    expect(canDeleteTemple(legacyAdmin, templeDraft())).toBe(true)
  })
})
