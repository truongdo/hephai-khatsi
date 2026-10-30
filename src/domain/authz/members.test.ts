import { describe, expect, it } from 'vitest'
import { canListDirectory } from './caller'
import { canCreateMember, canDeleteMember, canUpdateMember } from './members'
import {
  anon,
  gdAdmin,
  hePhaiAdmin,
  INVITE_ID,
  invites,
  kiemSoat,
  legacyAdmin,
  MEMBER_ID,
  memberDraft,
  memberLocked,
  patch,
  secretary,
  signedIn,
} from './testFixtures'

// Ported from firestoreRules.integration.test.ts (`members`, `members + temples
// org scope`, `he_phai_secretary`).

const seeded = invites()

const SAVE_AND_LOCK = {
  status: 'locked',
  lockedAt: '2026-01-02T00:00:00.000Z',
  lockedBy: 'filler',
  editRequestedAt: null,
  editRequestedBy: null,
  updatedAt: '2026-01-02T00:00:00.000Z',
}

describe('members', () => {
  it('rejects filler create with draft status', () => {
    expect(canCreateMember(anon, memberDraft(), seeded)).toBe(false)
    expect(
      canCreateMember(
        anon,
        memberDraft({ orgUnitId: 'gd-ii', sanghaType: 'ni', cccd: '012345678902' }),
        seeded,
      ),
    ).toBe(false)
  })

  it('allows filler create when status is locked by filler with null edit-request fields', () => {
    expect(canCreateMember(anon, memberLocked(), seeded)).toBe(true)
    expect(
      canCreateMember(
        anon,
        memberLocked({ orgUnitId: 'gd-ii', sanghaType: 'ni', cccd: '012345678902' }),
        seeded,
      ),
    ).toBe(true)
  })

  it('denies filler create when tinhTrang is set', () => {
    expect(canCreateMember(anon, memberLocked({ tinhTrang: 'sinh_hoat' }), seeded)).toBe(false)
  })

  it('denies filler save-and-lock when changing tinhTrang', () => {
    const before = memberDraft()
    const after = patch(before, { ...SAVE_AND_LOCK, theDanh: 'Nguyen Van A', tinhTrang: 'di_hoc' })
    expect(canUpdateMember(anon, before, after, seeded)).toBe(false)
  })

  it('allows filler save-and-lock that keeps an admin-set tinhTrang', () => {
    const before = memberDraft({ tinhTrang: 'gia_yeu' })
    const after = patch(before, { ...SAVE_AND_LOCK, theDanh: 'Nguyen Van A' })
    expect(canUpdateMember(anon, before, after, seeded)).toBe(true)
  })

  it('allows an admin to quick-edit tinhTrang on a locked member', () => {
    const before = memberLocked()
    const after = patch(before, { tinhTrang: 'vien_tich', updatedAt: '2026-01-02T00:00:00.000Z' })
    expect(canUpdateMember(signedIn('admin-uid', { role: 'he_phai_admin' }), before, after, seeded)).toBe(true)
  })

  it('rejects create when the doc id does not match orgUnitId_sanghaType_cccd', () => {
    expect(canCreateMember(anon, memberDraft({ id: 'wrong-id' }), seeded)).toBe(false)
    expect(canCreateMember(anon, memberLocked({ id: 'wrong-id' }), seeded)).toBe(false)
    expect(canCreateMember(hePhaiAdmin, memberDraft({ id: 'wrong-id', inviteId: null }), seeded)).toBe(false)
  })

  it('rejects create with an invite id that does not exist', () => {
    expect(canCreateMember(anon, memberDraft({ inviteId: 'does-not-exist' }), seeded)).toBe(false)
    expect(canCreateMember(anon, memberLocked({ inviteId: 'does-not-exist' }), seeded)).toBe(false)
  })

  it('rejects kiem_soat create even with a valid invite', () => {
    expect(canCreateMember(kiemSoat, memberDraft(), seeded)).toBe(false)
    expect(canCreateMember(kiemSoat, memberLocked(), seeded)).toBe(false)
  })

  it('lets filler read a draft but not persist profile changes without locking', () => {
    const before = memberDraft()
    expect(
      canUpdateMember(anon, before, patch(before, { theDanh: 'Nguyen Van A', updatedAt: '2026-01-02T00:00:00.000Z' }), seeded),
    ).toBe(false)
    expect(canUpdateMember(anon, before, patch(before, { status: 'locked' }), seeded)).toBe(false)
    expect(canUpdateMember(anon, before, patch(before, { orgUnitId: 'gd-ii' }), seeded)).toBe(false)
  })

  it('allows filler draft to locked save-and-lock with profile changes', () => {
    const before = memberDraft()
    const after = patch(before, { ...SAVE_AND_LOCK, theDanh: 'Nguyen Van A' })
    expect(canUpdateMember(anon, before, after, seeded)).toBe(true)
  })

  it('allows filler save-and-lock on an admin-created draft, adopting the invite', () => {
    const before = memberDraft({ inviteId: null })
    const after = patch(before, { ...SAVE_AND_LOCK, theDanh: 'Nguyen Van A', inviteId: INVITE_ID })
    expect(canUpdateMember(anon, before, after, seeded)).toBe(true)
  })

  it('denies filler adopting an admin-created draft without locking it', () => {
    const before = memberDraft({ inviteId: null })
    const after = patch(before, {
      photoPath: 'members/x/photo.jpg',
      inviteId: INVITE_ID,
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    expect(canUpdateMember(anon, before, after, seeded)).toBe(false)
  })

  it('denies filler replacing an existing invite on save-and-lock', () => {
    const before = memberDraft({ inviteId: 'other' })
    const after = patch(before, { ...SAVE_AND_LOCK, inviteId: INVITE_ID })
    expect(canUpdateMember(anon, before, after, invites('other'))).toBe(false)
  })

  it('blocks filler profile updates on locked records', () => {
    const before = memberLocked({ lockedAt: '2026-01-02T00:00:00.000Z' })
    const after = patch(before, { theDanh: 'Should fail', updatedAt: '2026-01-03T00:00:00.000Z' })
    expect(canUpdateMember(anon, before, after, seeded)).toBe(false)
  })

  it('allows filler edit-request on locked record', () => {
    const before = memberLocked({ lockedAt: '2026-01-02T00:00:00.000Z' })
    const after = patch(before, {
      editRequestedAt: '2026-01-03T00:00:00.000Z',
      editRequestedBy: '0912345678',
      updatedAt: '2026-01-03T00:00:00.000Z',
    })
    expect(canUpdateMember(anon, before, after, seeded)).toBe(true)
  })

  it('allows filler photoPath update on locked record', () => {
    const before = memberLocked({ lockedAt: '2026-01-02T00:00:00.000Z', photoPath: null })
    const after = patch(before, {
      photoPath: 'members/gd-i_tang_012345678901/photo.jpg',
      updatedAt: '2026-01-03T00:00:00.000Z',
    })
    expect(canUpdateMember(anon, before, after, seeded)).toBe(true)
  })

  it('denies filler photoPath replace when locked record already has a photo', () => {
    const before = memberLocked({
      lockedAt: '2026-01-02T00:00:00.000Z',
      photoPath: 'members/gd-i_tang_012345678901/photo.jpg',
    })
    const after = patch(before, {
      photoPath: 'members/gd-i_tang_012345678901/photo-replaced.jpg',
      updatedAt: '2026-01-03T00:00:00.000Z',
    })
    expect(canUpdateMember(anon, before, after, seeded)).toBe(false)
  })

  it('denies filler photoPath clear when locked record already has a photo', () => {
    const before = memberLocked({
      lockedAt: '2026-01-02T00:00:00.000Z',
      photoPath: 'members/gd-i_tang_012345678901/photo.jpg',
    })
    const after = patch(before, { photoPath: null, updatedAt: '2026-01-03T00:00:00.000Z' })
    expect(canUpdateMember(anon, before, after, seeded)).toBe(false)
  })

  it('allows filler to clear and replace photoPath on unlocked (draft) record', () => {
    const withPhoto = memberDraft({ photoPath: 'members/gd-i_tang_012345678901/photo.jpg' })
    const cleared = patch(withPhoto, { photoPath: null, updatedAt: '2026-01-03T00:00:00.000Z' })
    expect(canUpdateMember(anon, withPhoto, cleared, seeded)).toBe(true)
    const attached = patch(cleared, {
      photoPath: 'members/gd-i_tang_012345678901/photo.jpg',
      updatedAt: '2026-01-04T00:00:00.000Z',
    })
    expect(canUpdateMember(anon, cleared, attached, seeded)).toBe(true)
    const replaced = patch(attached, {
      photoPath: 'members/gd-i_tang_012345678901/photo-replaced.jpg',
      updatedAt: '2026-01-05T00:00:00.000Z',
    })
    expect(canUpdateMember(anon, attached, replaced, seeded)).toBe(true)
  })

  it('allows filler document changes on unlocked (draft) record but not on locked', () => {
    const documents = { cccdFront: { path: 'members/x/docs/cccd.jpg', uploadedAt: '2026-01-02T00:00:00.000Z' } }
    const draft = memberDraft()
    expect(
      canUpdateMember(anon, draft, patch(draft, { documents, updatedAt: '2026-01-02T00:00:00.000Z' }), seeded),
    ).toBe(true)
    const locked = memberLocked()
    expect(
      canUpdateMember(anon, locked, patch(locked, { documents, updatedAt: '2026-01-02T00:00:00.000Z' }), seeded),
    ).toBe(true)
    const lockedWithPhoto = memberLocked({ photoPath: 'members/x/photo.jpg' })
    expect(
      canUpdateMember(
        anon,
        lockedWithPhoto,
        patch(lockedWithPhoto, { documents, updatedAt: '2026-01-02T00:00:00.000Z' }),
        seeded,
      ),
    ).toBe(true)
  })

  it('lets admin lock and unlock regardless of current status, but not sneak in profile edits during a lock transition', () => {
    const draft = memberDraft()
    const locked = patch(draft, {
      status: 'locked',
      lockedAt: '2026-01-02T00:00:00.000Z',
      lockedBy: 'admin-uid',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    expect(canUpdateMember(legacyAdmin, draft, locked, seeded)).toBe(true)
    const sneaky = patch(locked, {
      status: 'draft',
      lockedAt: null,
      lockedBy: null,
      theDanh: 'sneaky',
      updatedAt: '2026-01-02T00:01:00.000Z',
    })
    expect(canUpdateMember(legacyAdmin, locked, sneaky, seeded)).toBe(false)
  })

  it('lets admin unlock clear edit-request fields', () => {
    const before = memberLocked({
      lockedAt: '2026-01-02T00:00:00.000Z',
      lockedBy: 'filler',
      editRequestedAt: '2026-01-03T00:00:00.000Z',
      editRequestedBy: '0912345678',
    })
    const after = patch(before, {
      status: 'draft',
      lockedAt: null,
      lockedBy: null,
      editRequestedAt: null,
      editRequestedBy: null,
      updatedAt: '2026-01-04T00:00:00.000Z',
    })
    expect(canUpdateMember(legacyAdmin, before, after, seeded)).toBe(true)
  })

  it('allows admin to update profile fields on a locked member without unlocking', () => {
    const before = memberDraft({
      status: 'locked',
      lockedAt: '2026-01-02T00:00:00.000Z',
      lockedBy: 'admin-uid',
      photoPath: null,
    })
    const after = patch(before, {
      phapDanh: 'Updated',
      photoPath: 'members/gd-i_tang_012345678901/photo.jpg',
      updatedAt: '2026-01-03T00:00:00.000Z',
    })
    expect(canUpdateMember(legacyAdmin, before, after, seeded)).toBe(true)
    // still cannot change org unit
    expect(canUpdateMember(legacyAdmin, after, patch(after, { orgUnitId: 'gd-ii' }), seeded)).toBe(false)
    // anon still blocked
    expect(canUpdateMember(anon, after, patch(after, { phapDanh: 'x' }), seeded)).toBe(false)
  })

  it('denies admin changing the invite of a member', () => {
    const before = memberDraft()
    expect(canUpdateMember(legacyAdmin, before, patch(before, { inviteId: null }), seeded)).toBe(false)
  })

  it('restricts listing to admins only', () => {
    expect(canListDirectory(anon, { orgUnitId: null })).toBe(false)
    expect(canListDirectory(signedIn('someone'), { orgUnitId: null })).toBe(false)
    expect(canListDirectory(legacyAdmin, { orgUnitId: null })).toBe(true)
  })

  it('allows admin delete but denies unauthenticated delete', () => {
    expect(canDeleteMember(anon, memberDraft())).toBe(false)
    expect(canDeleteMember(legacyAdmin, memberDraft())).toBe(true)
  })

  it('allows he_phai_admin to move a draft member to a new org unit document', () => {
    const before = memberDraft()
    expect(canDeleteMember(legacyAdmin, before)).toBe(true)
    expect(
      canCreateMember(
        legacyAdmin,
        memberDraft({ orgUnitId: 'gd-ii', updatedAt: '2026-01-02T00:00:00.000Z' }),
        seeded,
      ),
    ).toBe(true)
  })

  it('denies he_phai_secretary from creating a draft member that keeps inviteId', () => {
    expect(canCreateMember(secretary, memberDraft({ orgUnitId: 'gd-ii' }), seeded)).toBe(false)
    expect(canCreateMember(secretary, memberDraft({ orgUnitId: 'gd-ii', inviteId: null }), seeded)).toBe(true)
  })

  it('allows a signed-in user without a staff role to fill like a visitor', () => {
    expect(canCreateMember(signedIn('someone'), memberLocked(), seeded)).toBe(true)
  })
})

describe('members org scope (giao_doan_admin)', () => {
  const ownOrg = memberDraft({ inviteId: null })
  const otherOrg = memberDraft({ orgUnitId: 'gd-ii', cccd: '012345678902', inviteId: null })

  it('giao_doan_admin list members requires orgUnitId filter matching claim', () => {
    expect(canListDirectory(gdAdmin, { orgUnitId: null })).toBe(false)
    expect(canListDirectory(gdAdmin, { orgUnitId: 'gd-ii' })).toBe(false)
    expect(canListDirectory(gdAdmin, { orgUnitId: 'gd-i' })).toBe(true)
  })

  it('giao_doan_admin cannot update member in other org', () => {
    const after = patch(otherOrg, { phapDanh: 'Cross-org edit', updatedAt: '2026-01-02T00:00:00.000Z' })
    expect(canUpdateMember(gdAdmin, otherOrg, after, seeded)).toBe(false)
    expect(canDeleteMember(gdAdmin, otherOrg)).toBe(false)
  })

  it('giao_doan_admin can create, update and delete members in own org only', () => {
    expect(canCreateMember(gdAdmin, ownOrg, seeded)).toBe(true)
    expect(canCreateMember(gdAdmin, otherOrg, seeded)).toBe(false)
    const after = patch(ownOrg, { phapDanh: 'Own-org edit', updatedAt: '2026-01-02T00:00:00.000Z' })
    expect(canUpdateMember(gdAdmin, ownOrg, after, seeded)).toBe(true)
    expect(canDeleteMember(gdAdmin, ownOrg)).toBe(true)
  })

  it('he_phai_admin update that changes directoryRole fails', () => {
    const after = patch(ownOrg, {
      directoryRole: 'giao_doan_admin',
      directoryAuthUid: 'some-uid',
      directoryRoleGrantedAt: '2026-01-01T00:00:00.000Z',
      directoryRoleGrantedBy: 'hp-admin',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    expect(canUpdateMember(hePhaiAdmin, ownOrg, after, seeded)).toBe(false)
  })

  const secretaryMember = memberDraft({
    inviteId: null,
    email: 'secretary@gmail.com',
    directoryRole: 'giao_doan_admin',
    directoryAuthUid: 'auth-uid',
    directoryRoleGrantedAt: '2026-01-01T00:00:00.000Z',
    directoryRoleGrantedBy: 'hp-admin',
  })

  it('he_phai_admin cannot change email when member has directoryRole', () => {
    const after = patch(secretaryMember, { email: 'other@gmail.com', updatedAt: '2026-01-02T00:00:00.000Z' })
    expect(canUpdateMember(hePhaiAdmin, secretaryMember, after, seeded)).toBe(false)
  })

  it('he_phai_admin can update other fields when secretary email unchanged', () => {
    const after = patch(secretaryMember, { phapDanh: 'Updated name', updatedAt: '2026-01-02T00:00:00.000Z' })
    expect(canUpdateMember(hePhaiAdmin, secretaryMember, after, seeded)).toBe(true)
  })

  it('he_phai_admin can change email of a member without directoryRole', () => {
    const before = memberDraft({ inviteId: null, email: 'a@gmail.com' })
    const after = patch(before, { email: 'b@gmail.com', updatedAt: '2026-01-02T00:00:00.000Z' })
    expect(canUpdateMember(hePhaiAdmin, before, after, seeded)).toBe(true)
  })
})

describe('members he_phai_secretary', () => {
  it('can list members without org filter', () => {
    expect(canListDirectory(secretary, { orgUnitId: null })).toBe(true)
  })

  it('can update member in any org', () => {
    const before = memberDraft({ orgUnitId: 'gd-ii', cccd: '012345678902', inviteId: null })
    const after = patch(before, { phapDanh: 'Cross-org edit', updatedAt: '2026-01-02T00:00:00.000Z' })
    expect(canUpdateMember(secretary, before, after, seeded)).toBe(true)
  })
})

it('uses the member id the rules tests use', () => {
  expect(memberDraft().id).toBe(MEMBER_ID)
})
