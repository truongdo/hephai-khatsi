import { describe, expect, it } from 'vitest'
import { canCreateAuditLog, canReadAuditLogs } from './auditLogs'
import { canListDirectory, type Caller, type InviteExists } from './caller'
import { canCreateInvite, canListInvites } from './invites'
import { canCreateMember, canDeleteMember, canUpdateMember } from './members'
import { canWriteOrgUnit } from './orgUnits'
import { canCreateRegistration, canReviewRegistration } from './registrations'
import { canCreateRetreat, canDeleteRetreat, canUpdateRetreat } from './retreats'
import { canCreateTemple, canDeleteTemple, canUpdateTemple } from './temples'
import {
  anon,
  auditLogEntry,
  gdAdmin,
  hePhaiAdmin,
  invites,
  kiemSoat,
  legacyAdmin,
  memberDraft,
  memberLocked,
  patch,
  registrationDraft,
  retreatDraft,
  secretary,
  signedIn,
  templeDraft,
  templeLocked,
} from './testFixtures'

// One row per caller, one column per action: every role sees the same
// scenarios. "own" is org unit gd-i (the giáo đoàn admin's), "other" is gd-ii.

const ACTIONS = {
  listUnfiltered: (c: Caller) => canListDirectory(c, { orgUnitId: null }),
  listOwnOrg: (c: Caller) => canListDirectory(c, { orgUnitId: 'gd-i' }),
  listOtherOrg: (c: Caller) => canListDirectory(c, { orgUnitId: 'gd-ii' }),
  writeOrgUnit: (c: Caller) => canWriteOrgUnit(c),
  listInvites: (c: Caller) => canListInvites(c),
  createInvite: (c: Caller) =>
    canCreateInvite(c, {
      id: 'new',
      token: 'new',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: c?.uid ?? '',
      kind: 'filler',
      retreatId: null,
      orgUnitId: null,
      disabled: false,
    }),
  createMemberDraftOwnOrg: (c: Caller, i: InviteExists) =>
    canCreateMember(c, memberDraft({ inviteId: null }), i),
  createMemberDraftOtherOrg: (c: Caller, i: InviteExists) =>
    canCreateMember(c, memberDraft({ orgUnitId: 'gd-ii', inviteId: null }), i),
  fillMember: (c: Caller, i: InviteExists) => canCreateMember(c, memberLocked(), i),
  editMemberOwnOrg: (c: Caller, i: InviteExists) => {
    const before = memberDraft({ inviteId: null })
    return canUpdateMember(c, before, patch(before, { phapDanh: 'x' }), i)
  },
  editMemberOtherOrg: (c: Caller, i: InviteExists) => {
    const before = memberDraft({ orgUnitId: 'gd-ii', inviteId: null })
    return canUpdateMember(c, before, patch(before, { phapDanh: 'x' }), i)
  },
  saveAndLockMember: (c: Caller, i: InviteExists) => {
    const before = memberDraft()
    const after = patch(before, {
      phapDanh: 'x',
      status: 'locked',
      lockedAt: '2026-01-02T00:00:00.000Z',
      lockedBy: 'filler',
    })
    return canUpdateMember(c, before, after, i)
  },
  deleteMemberOwnOrg: (c: Caller) => canDeleteMember(c, memberDraft()),
  deleteMemberOtherOrg: (c: Caller) => canDeleteMember(c, memberDraft({ orgUnitId: 'gd-ii' })),
  createTempleDraftOwnOrg: (c: Caller, i: InviteExists) =>
    canCreateTemple(c, templeDraft({ inviteId: null }), i),
  fillTemple: (c: Caller, i: InviteExists) => canCreateTemple(c, templeLocked(), i),
  editTempleOtherOrg: (c: Caller, i: InviteExists) => {
    const before = templeDraft({ orgUnitId: 'gd-ii' })
    return canUpdateTemple(c, before, patch(before, { danhHieu: 'x' }), i)
  },
  moveTempleOrg: (c: Caller, i: InviteExists) => {
    const before = templeDraft()
    return canUpdateTemple(c, before, patch(before, { orgUnitId: 'gd-ii' }), i)
  },
  deleteTempleOwnOrg: (c: Caller) => canDeleteTemple(c, templeDraft()),
  readAuditLogs: (c: Caller) => canReadAuditLogs(c),
  fillerAuditLog: (c: Caller, i: InviteExists) =>
    canCreateAuditLog(
      c,
      memberLocked(),
      auditLogEntry({ actorType: 'filler', actorId: '0912345678' }),
      i,
    ),
  createRetreatOwnOrg: (c: Caller) =>
    canCreateRetreat(c, retreatDraft({ createdBy: c?.uid ?? '' })),
  createRetreatOtherOrg: (c: Caller) =>
    canCreateRetreat(c, retreatDraft({ orgUnitId: 'gd-ii', createdBy: c?.uid ?? '' })),
  openRetreatOwnOrg: (c: Caller) => {
    const before = retreatDraft()
    return canUpdateRetreat(c, before, patch(before, { status: 'open' }))
  },
  deleteRetreatOwnOrg: (c: Caller) => canDeleteRetreat(c, retreatDraft()),
  selfRegister: (c: Caller) => canCreateRegistration(c, registrationDraft()),
  proxyRegisterOwnOrg: (c: Caller) =>
    canCreateRegistration(
      c,
      registrationDraft({ registeredVia: 'proxy', registeredBy: c?.uid ?? null }),
    ),
  reviewRegistrationOwnOrg: (c: Caller) => {
    const before = registrationDraft()
    const after = patch(before, {
      status: 'approved',
      approvedBy: c?.uid ?? null,
      approvedAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    return canReviewRegistration(c, before, after)
  },
} satisfies Record<string, (caller: Caller, inviteExists: InviteExists) => boolean>

type Action = keyof typeof ACTIONS
type Expectations = Record<Action, boolean>

const NONE = Object.fromEntries(Object.keys(ACTIONS).map((a) => [a, false])) as Expectations

const HE_PHAI_SCOPE: Expectations = {
  listUnfiltered: true,
  listOwnOrg: true,
  listOtherOrg: true,
  writeOrgUnit: false,
  listInvites: true,
  createInvite: true,
  createMemberDraftOwnOrg: true,
  createMemberDraftOtherOrg: true,
  fillMember: false,
  editMemberOwnOrg: true,
  editMemberOtherOrg: true,
  saveAndLockMember: false,
  deleteMemberOwnOrg: true,
  deleteMemberOtherOrg: true,
  createTempleDraftOwnOrg: true,
  fillTemple: false,
  editTempleOtherOrg: true,
  moveTempleOrg: false,
  deleteTempleOwnOrg: true,
  readAuditLogs: true,
  fillerAuditLog: true,
  createRetreatOwnOrg: true,
  createRetreatOtherOrg: true,
  openRetreatOwnOrg: true,
  deleteRetreatOwnOrg: true,
  selfRegister: true,
  proxyRegisterOwnOrg: true,
  reviewRegistrationOwnOrg: true,
}

/** Directory writers create drafts; the filler create shape is accepted for members (rules quirk). */
const HE_PHAI_ADMIN: Expectations = {
  ...HE_PHAI_SCOPE,
  writeOrgUnit: true,
  fillMember: true,
  moveTempleOrg: true,
}

const VISITOR_WITH_INVITE: Expectations = {
  ...NONE,
  fillMember: true,
  saveAndLockMember: true,
  fillTemple: true,
  fillerAuditLog: true,
  selfRegister: true,
}

const ROLES: Array<{ name: string; caller: Caller; inviteExists: InviteExists; expected: Expectations }> = [
  { name: 'he_phai_admin', caller: hePhaiAdmin, inviteExists: invites(), expected: HE_PHAI_ADMIN },
  { name: 'legacy admin:true', caller: legacyAdmin, inviteExists: invites(), expected: HE_PHAI_ADMIN },
  {
    name: 'he_phai_secretary',
    caller: secretary,
    inviteExists: invites(),
    expected: { ...HE_PHAI_SCOPE, fillMember: true },
  },
  {
    name: 'giao_doan_admin (own org gd-i)',
    caller: gdAdmin,
    inviteExists: invites(),
    expected: {
      ...HE_PHAI_SCOPE,
      listUnfiltered: false,
      listOtherOrg: false,
      createMemberDraftOtherOrg: false,
      fillMember: true,
      editMemberOtherOrg: false,
      deleteMemberOtherOrg: false,
      editTempleOtherOrg: false,
      createRetreatOtherOrg: false,
    },
  },
  {
    name: 'giao_doan_admin (other org gd-ii)',
    caller: signedIn('gd-admin-2', { role: 'giao_doan_admin', orgUnitId: 'gd-ii' }),
    inviteExists: invites(),
    expected: {
      ...NONE,
      listOtherOrg: true,
      listInvites: true,
      createInvite: true,
      createMemberDraftOtherOrg: true,
      fillMember: true,
      editMemberOtherOrg: true,
      deleteMemberOtherOrg: true,
      editTempleOtherOrg: true,
      readAuditLogs: true,
      fillerAuditLog: true,
      createRetreatOtherOrg: true,
      selfRegister: true,
    },
  },
  {
    name: 'kiem_soat',
    caller: kiemSoat,
    inviteExists: invites(),
    expected: { ...NONE, selfRegister: true },
  },
  { name: 'anonymous filler with a valid invite', caller: anon, inviteExists: invites(), expected: VISITOR_WITH_INVITE },
  {
    name: 'anonymous filler without a valid invite',
    caller: anon,
    inviteExists: () => false,
    expected: { ...NONE, selfRegister: true },
  },
  {
    name: 'signed-in user without a staff role',
    caller: signedIn('someone'),
    inviteExists: invites(),
    expected: VISITOR_WITH_INVITE,
  },
]

describe.each(ROLES)('$name', ({ caller, inviteExists, expected }) => {
  it.each(Object.keys(ACTIONS) as Action[])('%s', (action) => {
    expect(ACTIONS[action](caller, inviteExists)).toBe(expected[action])
  })
})
