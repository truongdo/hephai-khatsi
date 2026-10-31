import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { memberDraft, templeLocked } from '#/domain/authz/testFixtures'
import { memberFromRow, memberToRow, type MemberRow } from './dataApi/rows/member'
import { inviteToRow } from './dataApi/rows/invite'
import { templeToRow } from './dataApi/rows/temple'
import { clearData, insertStatement } from './dataApi/test/db'
import { fillerInvite } from './dataApi/test/fixtures'
import { directoryMemberSource, recordSource } from './recordSource'
import { readSearchDocsPage } from './searchApi'

const secretaryMember = memberDraft({
  email: 'su.co@gmail.com',
  phapDanh: 'THÍCH NỮ A',
  directoryRole: 'giao_doan_admin',
  directoryAuthUid: 'uid-1',
  directoryRoleGrantedAt: '2026-07-01T00:00:00.000Z',
  directoryRoleGrantedBy: 'admin-1',
})

beforeEach(async () => {
  await clearData()
  await env.DB.batch([
    insertStatement('members', memberToRow(memberDraft({ photoPath: 'members/p.jpg' }))),
    insertStatement('members', memberToRow({ ...secretaryMember, id: 'gd-i_ni_1', sanghaType: 'ni', cccd: '1' })),
    insertStatement('temples', templeToRow(templeLocked({ photoPath: 'temples/t.jpg' }))),
    insertStatement('invites', inviteToRow(fillerInvite)),
  ])
})

describe('recordSource', () => {
  it('reads the member and temple fields the photo and document routes check', async () => {
    const source = recordSource(env)
    expect(await source.getMember(memberDraft().id)).toEqual({
      id: memberDraft().id,
      orgUnitId: 'gd-i',
      cccd: '012345678901',
      status: 'draft',
      inviteId: 'public',
      photoPath: 'members/p.jpg',
    })
    expect(await source.getTemple(templeLocked().id)).toEqual({
      id: templeLocked().id,
      orgUnitId: 'gd-i',
      status: 'locked',
      inviteId: 'public',
      photoPath: 'temples/t.jpg',
    })
    expect(await source.getMember('missing')).toBeNull()
  })

  it('checks that an invite exists', async () => {
    const source = recordSource(env)
    expect(await source.inviteExists('public')).toBe(true)
    expect(await source.inviteExists('nope')).toBe(false)
  })
})

describe('directoryMemberSource', () => {
  const source = () => directoryMemberSource(env)

  it('reads admin fields and lists secretaries', async () => {
    expect(await source().getMemberAdminFields('gd-i_ni_1')).toEqual({
      id: 'gd-i_ni_1',
      orgUnitId: 'gd-i',
      email: 'su.co@gmail.com',
      directoryRole: 'giao_doan_admin',
      directoryAuthUid: 'uid-1',
    })
    // No email: not a candidate.
    expect(await source().getMemberAdminFields(memberDraft().id)).toBeNull()
    expect(await source().listSecretaries()).toEqual([
      {
        id: 'gd-i_ni_1',
        orgUnitId: 'gd-i',
        email: 'su.co@gmail.com',
        phapDanh: 'THÍCH NỮ A',
        directoryRoleGrantedAt: '2026-07-01T00:00:00.000Z',
      },
    ])
  })

  it('patches the role columns and data fields, bumping the version', async () => {
    await source().patchMemberDirectoryFields('gd-i_ni_1', {
      directoryRole: null,
      directoryAuthUid: null,
      directoryRoleGrantedAt: null,
      directoryRoleGrantedBy: null,
    })
    const row = await env.DB.prepare('SELECT * FROM members WHERE id = ?')
      .bind('gd-i_ni_1')
      .first<MemberRow & { version: number }>()
    expect(row?.version).toBe(2)
    expect(memberFromRow(row!)).toMatchObject({
      email: 'su.co@gmail.com',
      directoryRoleGrantedAt: null,
      directoryRoleGrantedBy: null,
    })
    expect(memberFromRow(row!)).not.toHaveProperty('directoryRole')
    expect(await source().listSecretaries()).toEqual([])
  })

  it('fails on an unknown member', async () => {
    await expect(source().patchMemberDirectoryFields('missing', { directoryRole: null })).rejects.toThrow(
      'not found',
    )
  })
})

describe('readSearchDocsPage', () => {
  it('builds search documents from D1 in id order', async () => {
    const page = await readSearchDocsPage(env.DB, 'members', '')
    expect(page.documents.map((doc) => doc.id)).toEqual(['gd-i_ni_1', memberDraft().id])
    expect(page.nextCursor).toBeNull()
    const after = await readSearchDocsPage(env.DB, 'members', 'gd-i_ni_1')
    expect(after.documents.map((doc) => doc.id)).toEqual([memberDraft().id])
    const temples = await readSearchDocsPage(env.DB, 'temples', '')
    expect(temples.documents).toEqual([expect.objectContaining({ id: templeLocked().id, phones: ['0912345678'] })])
  })
})
