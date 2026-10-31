import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AuditLogEntry } from '#/domain/auditLog'
import {
  anon,
  gdAdmin,
  hePhaiAdmin,
  kiemSoat,
  memberDraft,
  memberLocked,
  secretary,
} from '#/domain/authz/testFixtures'
import type { Member } from '#/domain/types'
import type { AdminListPage } from '#/repositories/adminListTypes'
import { runDataRoute } from '../index'
import { memberToRow } from '../rows/member'
import { inviteToRow } from '../rows/invite'
import { clearData, insertStatement } from '../test/db'
import { fillerInvite } from '../test/fixtures'
import {
  NOW,
  callData,
  expectDomainError,
  fileCalls,
  fullTableScans,
  missingFiles,
  queryPlansOf,
  searchCalls,
} from '../test/callData'

const ADMIN_ACTOR = { actorType: 'admin', actorId: 'gd-admin' }
const FILLER_ACTOR = { actorType: 'filler', actorId: '0912345678' }

async function seedMembers(...members: Member[]): Promise<void> {
  await env.DB.batch(members.map((member) => insertStatement('members', memberToRow(member))))
}

async function seedInvite(): Promise<void> {
  await insertStatement('invites', inviteToRow(fillerInvite)).run()
}

async function versionOf(id: string): Promise<number | null> {
  return env.DB.prepare('SELECT version FROM members WHERE id = ?').bind(id).first<number>('version')
}

async function auditLogsOf(id: string): Promise<AuditLogEntry[]> {
  return callData<{ entries: AuditLogEntry[] }>(
    'audit-logs/list',
    { parentType: 'members', parentId: id },
    hePhaiAdmin,
  ).then((page) => page.entries)
}

beforeEach(async () => {
  await clearData()
  searchCalls.length = 0
  fileCalls.length = 0
})

describe('members/save-draft and save-and-lock', () => {
  const create = {
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    cccd: '012345678901',
    inviteId: null,
    patch: { phapDanh: 'THÍCH MINH A', giaoPhamHePhai: { rank: 'dai_duc' } },
    audit: ADMIN_ACTOR,
  }

  it('creates an admin draft with sort keys, an audit entry and a search update', async () => {
    const { member, mode } = await callData<{ member: Member; mode: string }>(
      'members/save-draft',
      create,
      gdAdmin,
    )
    expect(mode).toBe('created')
    expect(member).toMatchObject({
      id: 'gd-i_tang_012345678901',
      status: 'draft',
      createdAt: NOW,
      orgUnitName: 'Giáo đoàn I',
      giaoPhamHePhaiRankOrder: 2,
    })
    expect(await callData('members/get', { id: member.id })).toEqual(member)
    expect(await versionOf(member.id)).toBe(1)
    expect((await auditLogsOf(member.id)).map((entry) => entry.action)).toEqual(['created'])
    expect(searchCalls).toEqual([{ action: 'upsertMember', id: member.id }])
  })

  it('updates an existing draft and bumps its version', async () => {
    await callData('members/save-draft', create, gdAdmin)
    const { member, mode } = await callData<{ member: Member; mode: string }>(
      'members/save-draft',
      { ...create, patch: { phapDanh: 'THÍCH MINH B' } },
      gdAdmin,
    )
    expect(mode).toBe('updated')
    expect(member.phapDanh).toBe('THÍCH MINH B')
    expect(await versionOf(member.id)).toBe(2)
  })

  it('ignores server-set fields in the patch', async () => {
    const { member } = await callData<{ member: Member }>(
      'members/save-draft',
      { ...create, patch: { status: 'locked', tinhTrang: 'vien_tich', version: 9, phapDanh: 'A' } },
      gdAdmin,
    )
    expect(member.status).toBe('draft')
    expect(member).not.toHaveProperty('tinhTrang')
    expect(member).not.toHaveProperty('version')
  })

  it('never takes directory-role or edit-request fields from a patch', async () => {
    await seedInvite()
    const { member } = await callData<{ member: Member }>(
      'members/save-and-lock',
      {
        ...create,
        inviteId: 'public',
        audit: FILLER_ACTOR,
        patch: {
          email: 'victim@gmail.com',
          directoryRole: 'giao_doan_admin',
          directoryAuthUid: 'real-admin-uid',
          editRequestedAt: NOW,
        },
      },
      anon,
    )
    expect(member).not.toHaveProperty('directoryRole')
    expect(member).not.toHaveProperty('directoryAuthUid')
    expect(member.editRequestedAt).toBeNull()
    expect(await callData('members/secretaries', { role: 'giao_doan_admin' }, hePhaiAdmin)).toEqual([])
  })

  it.each([
    ['giaoPhamHePhai', { rank: {} }],
    ['dienThoai', 912345678],
    ['currentTempleId', ['t1']],
  ])('rejects a wrong-typed patch.%s', async (field, value) => {
    await expectDomainError(
      callData('members/save-draft', { ...create, patch: { [field]: value } }, gdAdmin),
      'INVALID_INPUT',
    )
  })

  it('refuses a giáo đoàn admin of another org unit', async () => {
    await expectDomainError(
      callData('members/save-draft', { ...create, orgUnitId: 'gd-ii' }, gdAdmin),
      'FORBIDDEN',
    )
  })

  it('lets a filler save and lock with an existing invite', async () => {
    await seedInvite()
    const { member } = await callData<{ member: Member }>(
      'members/save-and-lock',
      { ...create, inviteId: 'public', audit: FILLER_ACTOR },
      anon,
    )
    expect(member).toMatchObject({ status: 'locked', lockedBy: 'filler', lockedAt: NOW, inviteId: 'public' })
  })

  it.each([
    ['without an existing invite', anon],
    ['as kiểm soát', kiemSoat],
  ])('refuses a filler save-and-lock %s', async (_, caller) => {
    if (caller) await seedInvite()
    await expectDomainError(
      callData('members/save-and-lock', { ...create, inviteId: 'public', audit: FILLER_ACTOR }, caller),
      'FORBIDDEN',
    )
  })

  it('refuses to save over a locked member', async () => {
    await seedMembers(memberLocked())
    await expectDomainError(callData('members/save-draft', create, gdAdmin), 'RECORD_LOCKED')
  })

  it('rejects an invalid body', async () => {
    await expectDomainError(
      callData('members/save-draft', { ...create, sanghaType: 'other' }, gdAdmin),
      'INVALID_INPUT',
    )
  })
})

describe('members lifecycle writes', () => {
  it('locks and unlocks as a directory writer, with audit entries', async () => {
    await seedMembers(memberDraft())
    const id = memberDraft().id
    const locked = await callData<Member>(
      'members/lock',
      { memberId: id, lockedBy: 'gd-admin', audit: ADMIN_ACTOR },
      gdAdmin,
    )
    expect(locked).toMatchObject({ status: 'locked', lockedBy: 'gd-admin', lockedAt: NOW })
    const unlocked = await callData<Member>('members/unlock', { memberId: id, audit: ADMIN_ACTOR }, gdAdmin)
    expect(unlocked).toMatchObject({ status: 'draft', lockedAt: null, lockedBy: null })
    expect((await auditLogsOf(id)).map((entry) => entry.action).sort()).toEqual(['locked', 'unlocked'])
  })

  it('refuses unlock by a filler', async () => {
    await seedMembers(memberLocked())
    await expectDomainError(
      callData('members/unlock', { memberId: memberLocked().id, audit: FILLER_ACTOR }, anon),
      'FORBIDDEN',
    )
  })

  it('records a filler edit request once', async () => {
    await seedInvite()
    await seedMembers(memberLocked())
    const id = memberLocked().id
    const member = await callData<Member>('members/request-edit', { memberId: id, phone: '0912 345 678' }, anon)
    expect(member).toMatchObject({ editRequestedAt: NOW, editRequestedBy: '0912 345 678' })
    const [entry] = await auditLogsOf(id)
    expect(entry).toMatchObject({ action: 'edit_requested', actorType: 'filler', actorId: '0912345678' })

    const again = await callData<Member>(
      'members/request-edit',
      { memberId: id, phone: '0900000000' },
      anon,
      '2026-07-26T00:00:00.000Z',
    )
    expect(again.editRequestedBy).toBe('0912 345 678')
  })

  it('refuses an edit request on a draft', async () => {
    await seedMembers(memberDraft())
    await expectDomainError(
      callData('members/request-edit', { memberId: memberDraft().id, phone: '0912345678' }, anon),
      'INVALID_STATUS',
    )
  })

  it('returns NOT_FOUND for a missing member', async () => {
    await expectDomainError(
      callData('members/lock', { memberId: 'missing', lockedBy: 'x', audit: ADMIN_ACTOR }, gdAdmin),
      'NOT_FOUND',
    )
  })

  it('sets tinh trạng as admin only, skipping a no-op', async () => {
    await seedInvite()
    await seedMembers(memberLocked())
    const id = memberLocked().id
    await expectDomainError(
      callData('members/set-tinh-trang', { memberId: id, tinhTrang: 'di_hoc', audit: FILLER_ACTOR }, anon),
      'FORBIDDEN',
    )
    const member = await callData<Member>(
      'members/set-tinh-trang',
      { memberId: id, tinhTrang: 'di_hoc', audit: ADMIN_ACTOR },
      gdAdmin,
    )
    expect(member.tinhTrang).toBe('di_hoc')
    await callData('members/set-tinh-trang', { memberId: id, tinhTrang: 'di_hoc', audit: ADMIN_ACTOR }, gdAdmin)
    expect(await versionOf(id)).toBe(2)
  })

  it('lets a filler attach a first portrait to a locked member but not replace it', async () => {
    await seedInvite()
    await seedMembers(memberLocked())
    const id = memberLocked().id
    const member = await callData<Member>(
      'members/set-photo',
      { memberId: id, photoPath: `members/${id}/photo.jpg`, audit: FILLER_ACTOR },
      anon,
    )
    expect(member.photoPath).toBe(`members/${id}/photo.jpg`)
    await expectDomainError(
      callData('members/set-photo', { memberId: id, photoPath: null, audit: FILLER_ACTOR }, anon),
      'FORBIDDEN',
    )
  })

  it('merges and removes document sides, deleting the files they drop', async () => {
    await seedMembers(memberDraft())
    const id = memberDraft().id
    const docs = `members/${id}/docs/cccd`
    const ref = { memberId: id, typeId: 'cccd', audit: ADMIN_ACTOR }
    await callData('members/merge-document', { ...ref, side: 'front', filePath: `${docs}/front.jpg` }, gdAdmin)
    // Same path again (re-upload in place): nothing to delete.
    await callData('members/merge-document', { ...ref, side: 'front', filePath: `${docs}/front.jpg` }, gdAdmin)
    expect(fileCalls).toEqual([])
    const merged = await callData<Member>(
      'members/merge-document',
      { ...ref, side: 'front', filePath: `${docs}/front.pdf` },
      gdAdmin,
    )
    expect(merged.documents).toEqual({ cccd: { frontPath: `${docs}/front.pdf` } })
    expect(fileCalls).toEqual([{ action: 'delete', paths: [`${docs}/front.jpg`] }])
    const removed = await callData<Member>('members/remove-document', ref, gdAdmin)
    expect(removed.documents).toEqual({})
    expect(fileCalls.at(-1)).toEqual({ action: 'delete', paths: [`${docs}/front.pdf`] })
  })

  it('refuses a file path that is not the member’s own upload, or that was never uploaded', async () => {
    await seedInvite()
    const id = memberLocked().id
    const front = `members/${id}/docs/cccd/front.jpg`
    await seedMembers(memberLocked({ documents: { cccd: { frontPath: front } } }))
    const ref = { memberId: id, typeId: 'cccd', side: 'front', audit: FILLER_ACTOR }
    for (const filePath of ['x', `members/other/docs/cccd/front.pdf`, `members/${id}/docs/cccd/back.pdf`]) {
      await expectDomainError(callData('members/merge-document', { ...ref, filePath }, anon), 'INVALID_INPUT')
    }
    missingFiles.add(`members/${id}/docs/cccd/front.pdf`)
    try {
      await expectDomainError(
        callData('members/merge-document', { ...ref, filePath: `members/${id}/docs/cccd/front.pdf` }, anon),
        'INVALID_INPUT',
      )
    } finally {
      missingFiles.clear()
    }
    await expectDomainError(
      callData('members/save-draft', {
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        cccd: '012345678909',
        inviteId: null,
        patch: { photoPath: `members/someone/photo.jpg` },
      }, gdAdmin),
      'INVALID_INPUT',
    )
    expect(fileCalls).toEqual([])
    expect((await callData<Member>('members/get', { id }))?.documents).toEqual({ cccd: { frontPath: front } })
  })

  it('never deletes a file outside the member folder', async () => {
    await seedMembers(memberDraft({ photoPath: 'members/someone-else/photo.jpg' }))
    await callData(
      'members/set-photo',
      { memberId: memberDraft().id, photoPath: null, audit: ADMIN_ACTOR },
      gdAdmin,
    )
    expect(fileCalls).toEqual([])
  })

  it('deletes the photo a member drops', async () => {
    const photoPath = `members/${memberDraft().id}/photo.jpg`
    await seedMembers(memberDraft({ photoPath }))
    await callData('members/set-photo', { memberId: memberDraft().id, photoPath: null, audit: ADMIN_ACTOR }, gdAdmin)
    expect(fileCalls).toEqual([{ action: 'delete', paths: [photoPath] }])
  })

  it('lets a filler replace a document of a locked member but not remove it', async () => {
    await seedInvite()
    const id = memberLocked().id
    const front = `members/${id}/docs/cccd/front.jpg`
    await seedMembers(memberLocked({ documents: { cccd: { frontPath: front } } }))
    const ref = { memberId: id, typeId: 'cccd', audit: FILLER_ACTOR }
    await expectDomainError(callData('members/remove-document', ref, anon), 'FORBIDDEN')
    const replaced = await callData<Member>(
      'members/merge-document',
      { ...ref, side: 'front', filePath: `members/${id}/docs/cccd/front.pdf` },
      anon,
    )
    expect(replaced.documents?.cccd?.frontPath).toBe(`members/${id}/docs/cccd/front.pdf`)
    expect(fileCalls).toEqual([{ action: 'delete', paths: [front] }])
  })

  it('rejects a side the document type does not have', async () => {
    await expectDomainError(
      callData(
        'members/merge-document',
        { memberId: 'x', typeId: 'diep_sa_di', side: 'front', filePath: 'a.jpg', audit: ADMIN_ACTOR },
        gdAdmin,
      ),
      'INVALID_INPUT',
    )
  })
})

describe('members/update', () => {
  it('moves a draft to another org unit as hệ phái admin, with its history', async () => {
    await seedMembers(memberDraft({ inviteId: null }))
    const oldId = memberDraft().id
    await callData('members/lock', { memberId: oldId, lockedBy: 'x', audit: ADMIN_ACTOR }, hePhaiAdmin)
    await callData('members/unlock', { memberId: oldId, audit: ADMIN_ACTOR }, hePhaiAdmin)

    const member = await callData<Member>(
      'members/update',
      { memberId: oldId, patch: {}, allowOrgUnitChange: true, orgUnitId: 'gd-ii', audit: ADMIN_ACTOR },
      hePhaiAdmin,
    )
    expect(member).toMatchObject({ id: 'gd-ii_tang_012345678901', orgUnitId: 'gd-ii', orgUnitName: 'Giáo đoàn II' })
    expect(await callData('members/get', { id: oldId })).toBeNull()
    expect((await auditLogsOf(member.id)).map((entry) => entry.action).sort()).toEqual([
      'locked',
      'unlocked',
      'updated',
    ])
    expect(searchCalls.slice(-2)).toEqual([
      { action: 'deleteMember', id: oldId },
      { action: 'upsertMember', id: member.id },
    ])
  })

  it('moves the member files to the new id and deletes the old ones after the write', async () => {
    const oldId = memberDraft().id
    const newId = 'gd-ii_tang_012345678901'
    await seedMembers(
      memberDraft({
        photoPath: `members/${oldId}/photo.jpg`,
        documents: { cccd: { frontPath: `members/${oldId}/docs/cccd/front.jpg` } },
      }),
    )
    const member = await callData<Member>(
      'members/update',
      { memberId: oldId, patch: {}, allowOrgUnitChange: true, orgUnitId: 'gd-ii', audit: ADMIN_ACTOR },
      hePhaiAdmin,
    )
    expect(member.photoPath).toBe(`members/${newId}/photo.jpg`)
    expect(member.documents).toEqual({ cccd: { frontPath: `members/${newId}/docs/cccd/front.jpg` } })
    expect(fileCalls).toEqual([
      { action: 'copy', from: `members/${oldId}/docs/cccd/front.jpg`, to: `members/${newId}/docs/cccd/front.jpg` },
      { action: 'copy', from: `members/${oldId}/photo.jpg`, to: `members/${newId}/photo.jpg` },
      { action: 'delete', paths: [`members/${oldId}/photo.jpg`, `members/${oldId}/docs/cccd/front.jpg`] },
    ])
  })

  it('refuses a giáo đoàn admin moving a member out of their org unit', async () => {
    await seedMembers(memberDraft({ inviteId: null }))
    await expectDomainError(
      callData(
        'members/update',
        { memberId: memberDraft().id, patch: {}, allowOrgUnitChange: true, orgUnitId: 'gd-ii' },
        gdAdmin,
      ),
      'FORBIDDEN',
    )
  })

  it('refuses a move onto an existing member', async () => {
    await seedMembers(memberDraft(), memberDraft({ orgUnitId: 'gd-ii' }))
    await expectDomainError(
      callData(
        'members/update',
        { memberId: memberDraft().id, patch: {}, allowOrgUnitChange: true, orgUnitId: 'gd-ii' },
        hePhaiAdmin,
      ),
      'ALREADY_EXISTS',
    )
  })

  it('keeps the lock unless allowed', async () => {
    await seedMembers(memberLocked())
    await expectDomainError(
      callData('members/update', { memberId: memberLocked().id, patch: { phapDanh: 'B' } }, gdAdmin),
      'RECORD_LOCKED',
    )
    const member = await callData<Member>(
      'members/update',
      { memberId: memberLocked().id, patch: { phapDanh: 'B' }, allowWhenLocked: true },
      gdAdmin,
    )
    expect(member).toMatchObject({ phapDanh: 'B', status: 'locked' })
  })

  it('returns CONFLICT and writes nothing when the member changed after it was read', async () => {
    await seedMembers(memberDraft())
    const id = memberDraft().id
    // Another write lands between this request's read and its batch.
    const racingDb = new Proxy(env.DB, {
      get(target, prop) {
        if (prop === 'batch') {
          return async (statements: D1PreparedStatement[]) => {
            await target.prepare('UPDATE members SET version = version + 1 WHERE id = ?').bind(id).run()
            return target.batch(statements)
          }
        }
        const value = Reflect.get(target, prop)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    await expectDomainError(
      runDataRoute(
        'members/update',
        { memberId: id, patch: { phapDanh: 'B' }, audit: ADMIN_ACTOR },
        { db: racingDb, caller: gdAdmin, now: NOW, search: { upsertMember() {}, upsertTemple() {}, deleteMember() {}, deleteTemple() {} },
          files: { copy: async () => {}, exists: async () => true, deleteLater() {} },
        },
      ),
      'CONFLICT',
    )
    expect((await callData<Member>('members/get', { id }))?.phapDanh).toBeUndefined()
    expect(await auditLogsOf(id)).toEqual([])
  })
})

describe('members/delete-many', () => {
  it('deletes the members of the caller’s org unit', async () => {
    await seedMembers(memberDraft(), memberDraft({ cccd: '012345678902' }))
    const ids = [memberDraft().id, memberDraft({ cccd: '012345678902' }).id]
    await callData('members/delete-many', { ids }, gdAdmin)
    expect(await callData('members/get', { id: ids[0] })).toBeNull()
    expect(searchCalls).toEqual(ids.map((id) => ({ action: 'deleteMember', id })))
  })

  it('deletes the files of the deleted members', async () => {
    const id = memberDraft().id
    await seedMembers(
      memberDraft({
        photoPath: `members/${id}/photo.jpg`,
        documents: { diep_sa_di: { filePath: `members/${id}/docs/diep_sa_di/file.pdf` } },
      }),
    )
    await callData('members/delete-many', { ids: [id] }, gdAdmin)
    expect(fileCalls).toEqual([
      { action: 'delete', paths: [`members/${id}/photo.jpg`, `members/${id}/docs/diep_sa_di/file.pdf`] },
    ])
  })

  it('deletes more members than fit in one statement', async () => {
    const members = Array.from({ length: 100 }, (_, i) => memberDraft({ cccd: String(100000000000 + i) }))
    await seedMembers(...members)
    await callData('members/delete-many', { ids: members.map((m) => m.id) }, hePhaiAdmin)
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM members').first<number>('n')
    expect(left).toBe(0)
  })

  it('deletes nothing when one member is outside the caller’s org unit', async () => {
    const other = memberDraft({ orgUnitId: 'gd-ii' })
    await seedMembers(memberDraft(), other)
    await expectDomainError(
      callData('members/delete-many', { ids: [memberDraft().id, other.id] }, gdAdmin),
      'FORBIDDEN',
    )
    expect(await callData('members/get', { id: memberDraft().id })).not.toBeNull()
  })
})

describe('member reads', () => {
  it('gets by id and by CCCD without signing in', async () => {
    await seedMembers(memberDraft())
    expect(await callData('members/get', { id: memberDraft().id })).toEqual(memberDraft())
    expect(
      await callData('members/get-by-cccd', { orgUnitId: 'gd-i', sanghaType: 'tang', cccd: '012345678901' }),
    ).toEqual(memberDraft())
  })

  it('finds members by phone with an invite token', async () => {
    await seedInvite()
    await seedMembers(memberDraft({ dienThoai: '0912 345 678' }), memberDraft({ cccd: '012345678902' }))
    const lookup = { orgUnitId: 'gd-i', sanghaType: 'tang', phone: '0912345678' }
    await expectDomainError(callData('members/list-by-phone', lookup, anon), 'FORBIDDEN')
    await expectDomainError(
      callData('members/list-by-phone', { ...lookup, inviteToken: 'nope' }, anon),
      'FORBIDDEN',
    )
    const found = await callData<Member[]>('members/list-by-phone', { ...lookup, inviteToken: 'public' }, anon)
    expect(found.map((member) => member.id)).toEqual([memberDraft().id])
  })

  it.each([
    ['anonymous', anon, {}],
    ['kiểm soát', kiemSoat, { orgUnitId: 'gd-i' }],
    ['a giáo đoàn admin without an org filter', gdAdmin, {}],
    ['a giáo đoàn admin of another org unit', gdAdmin, { orgUnitId: 'gd-ii' }],
  ])('refuses a list by %s', async (_, caller, filter) => {
    await expectDomainError(callData('members/list', { sanghaType: 'tang', ...filter }, caller), 'FORBIDDEN')
  })

  it('pages with a stable cursor while rows are added', async () => {
    const members = Array.from({ length: 5 }, (_, i) =>
      memberDraft({ cccd: `01234567890${i}`, updatedAt: `2026-07-0${i + 1}T00:00:00.000Z` }),
    )
    await seedMembers(...members)
    const first = await callData<AdminListPage<Member>>(
      'members/list',
      { sanghaType: 'tang', orgUnitId: 'gd-i', limit: 2 },
      gdAdmin,
    )
    expect(first.items.map((m) => m.updatedAt.slice(0, 10))).toEqual(['2026-07-05', '2026-07-04'])
    // A newer member does not shift the next page.
    await seedMembers(memberDraft({ cccd: '012345678909', updatedAt: '2026-07-09T00:00:00.000Z' }))
    const second = await callData<AdminListPage<Member>>(
      'members/list',
      { sanghaType: 'tang', orgUnitId: 'gd-i', limit: 2, cursor: first.nextCursor },
      gdAdmin,
    )
    expect(second.items.map((m) => m.updatedAt.slice(0, 10))).toEqual(['2026-07-03', '2026-07-02'])
    const last = await callData<AdminListPage<Member>>(
      'members/list',
      { sanghaType: 'tang', orgUnitId: 'gd-i', limit: 2, cursor: second.nextCursor },
      gdAdmin,
    )
    expect(last.items.map((m) => m.updatedAt.slice(0, 10))).toEqual(['2026-07-01'])
    expect(last.nextCursor).toBeNull()
  })

  it('sorts ascending by rank and skips members without a sort value', async () => {
    await seedMembers(
      memberDraft({ cccd: '012345678901', giaoPhamHePhaiRankOrder: 3 }),
      memberDraft({ cccd: '012345678902', giaoPhamHePhaiRankOrder: 1 }),
      memberDraft({ cccd: '012345678903' }),
    )
    const page = await callData<AdminListPage<Member>>(
      'members/list',
      { sanghaType: 'tang', sortBy: 'giaoPhamHePhaiRankOrder', sortDir: 'asc' },
      secretary,
    )
    expect(page.items.map((m) => m.giaoPhamHePhaiRankOrder)).toEqual([1, 3])
  })

  it('lists and counts a hạ lạp tab', async () => {
    await seedMembers(
      memberDraft({ cccd: '012345678901', haLapTabRank: 'dai_duc', sapXepHaLap: '02|b' }),
      memberDraft({ cccd: '012345678902', haLapTabRank: 'dai_duc', sapXepHaLap: '02|a' }),
      memberDraft({ cccd: '012345678903', haLapTabRank: 'sa_di', sapXepHaLap: '04|a' }),
    )
    const tab = { sanghaType: 'tang', haLapTabRank: 'dai_duc', orgUnitId: 'gd-i' }
    const page = await callData<AdminListPage<Member>>('members/list-ha-lap', tab, gdAdmin)
    expect(page.items.map((m) => m.sapXepHaLap)).toEqual(['02|a', '02|b'])
    expect(await callData('members/count-ha-lap', tab, gdAdmin)).toEqual({ count: 2 })
  })

  it('lists members of temples within the caller’s scope', async () => {
    await seedMembers(
      memberDraft({ currentTempleId: 't1' }),
      memberDraft({ orgUnitId: 'gd-ii', currentTempleId: 't1' }),
    )
    const scoped = await callData<Member[]>('members/by-temples', { templeIds: ['t1'] }, gdAdmin)
    expect(scoped.map((m) => m.orgUnitId)).toEqual(['gd-i'])
    const all = await callData<Member[]>('members/by-temples', { templeIds: ['t1'] }, hePhaiAdmin)
    expect(all).toHaveLength(2)
  })

  it('lists secretaries by role', async () => {
    await seedMembers(memberDraft({ directoryRole: 'giao_doan_admin' }), memberDraft({ cccd: '012345678902' }))
    const found = await callData<Member[]>('members/secretaries', { role: 'giao_doan_admin' }, hePhaiAdmin)
    expect(found.map((m) => m.id)).toEqual([memberDraft().id])
  })
})

describe('member list and count queries use an index', () => {
  it.each([
    ['members/list', { sanghaType: 'tang' }],
    ['members/list', { sanghaType: 'tang', status: 'locked' }],
    ['members/list', { sanghaType: 'tang', orgUnitId: 'gd-i' }],
    ['members/list', { sanghaType: 'tang', orgUnitId: 'gd-i', status: 'draft' }],
    ['members/list', { sanghaType: 'tang', sortBy: 'giaoPhamHePhaiRankOrder', sortDir: 'asc' }],
    ['members/list', { sanghaType: 'tang', orgUnitId: 'gd-i', sortBy: 'giaoPhamHePhaiRankOrder' }],
    ['members/list', { sanghaType: 'tang', sortBy: 'orgUnitName' }],
    ['members/list', { sanghaType: 'tang', orgUnitId: 'gd-i', sortBy: 'orgUnitName' }],
    ['members/list', { sanghaType: 'tang', sortBy: 'status' }],
    ['members/list', { sanghaType: 'tang', orgUnitId: 'gd-i', sortBy: 'status' }],
    ['members/list-ha-lap', { sanghaType: 'tang', haLapTabRank: 'dai_duc' }],
    ['members/list-ha-lap', { sanghaType: 'tang', haLapTabRank: 'dai_duc', orgUnitId: 'gd-i', status: 'draft' }],
    ['members/count-ha-lap', { sanghaType: 'tang', haLapTabRank: 'dai_duc' }],
    ['members/count-ha-lap', { sanghaType: 'tang', haLapTabRank: 'dai_duc', orgUnitId: 'gd-i' }],
    ['members/by-temples', { templeIds: ['t1', 't2'] }],
    ['members/secretaries', { role: 'he_phai_secretary' }],
    ['members/list-by-phone', { orgUnitId: 'gd-i', sanghaType: 'tang', phone: '0912345678' }],
  ])('%s %o', async (name, body) => {
    const plans = await queryPlansOf(name, body, hePhaiAdmin)
    expect(plans.length).toBeGreaterThan(0)
    expect(fullTableScans(plans)).toEqual([])
  })
})
