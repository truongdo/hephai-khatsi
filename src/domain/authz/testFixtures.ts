import type { AuditLogWrite } from '#/domain/auditLog'
import { parseAuthClaims } from '#/domain/authClaims'
import { memberCccdIndexId } from '#/domain/memberCccdIndex'
import type { Retreat } from '#/domain/retreat'
import type { RetreatRegistration } from '#/domain/retreatRegistration'
import type { Member, Temple } from '#/domain/types'
import type { Caller, InviteExists } from './caller'

// Records and callers mirroring `firestoreRules.integration.test.ts`, so the
// authz tests read like the rules tests they port.

export const INVITE_ID = 'public'

/** The seeded invites: only `public`, unless a test adds more. */
export function invites(...ids: string[]): InviteExists {
  const known = new Set([INVITE_ID, ...ids])
  return (id) => known.has(id)
}

/** The rules tests' `authenticatedContext(uid, claims)`. */
export function signedIn(uid: string, rawClaims: Record<string, unknown> = {}): Caller {
  return { uid, claims: parseAuthClaims(rawClaims) }
}

export const anon: Caller = null
export const legacyAdmin = signedIn('admin-uid', { admin: true })
export const hePhaiAdmin = signedIn('hp-admin', { role: 'he_phai_admin' })
export const secretary = signedIn('hp-sec', { role: 'he_phai_secretary' })
export const gdAdmin = signedIn('gd-admin', { role: 'giao_doan_admin', orgUnitId: 'gd-i' })
export const kiemSoat = signedIn('ks', { role: 'kiem_soat', orgUnitId: 'gd-i' })

/** Firestore `updateDoc`: the stored record merged with the patch. */
export function patch<T extends object>(before: T, changes: Partial<Record<string, unknown>>): T {
  return { ...before, ...changes } as T
}

export const MEMBER_ID = 'gd-i_tang_012345678901'
export const TEMPLE_ID = 'temple-1'

export function memberDraft(overrides: Partial<Member> = {}): Member {
  const base: Member = {
    id: '',
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    status: 'draft',
    cccd: '012345678901',
    inviteId: INVITE_ID,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
  return {
    ...base,
    id: overrides.id ?? memberCccdIndexId(base.orgUnitId, base.sanghaType, base.cccd),
  }
}

export function memberLocked(overrides: Partial<Member> = {}): Member {
  return memberDraft({
    status: 'locked',
    lockedAt: '2026-01-01T00:00:00.000Z',
    lockedBy: 'filler',
    ...overrides,
  })
}

export function templeDraft(overrides: Partial<Temple> = {}): Temple {
  return {
    id: TEMPLE_ID,
    orgUnitId: 'gd-i',
    status: 'draft',
    managerPhones: ['0912345678'],
    inviteId: INVITE_ID,
    photoPath: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

export function templeLocked(overrides: Partial<Temple> = {}): Temple {
  return templeDraft({
    status: 'locked',
    lockedAt: '2026-01-01T00:00:00.000Z',
    lockedBy: 'filler',
    ...overrides,
  })
}

export function auditLogEntry(overrides: Partial<AuditLogWrite> = {}): AuditLogWrite {
  return {
    action: 'updated',
    at: '2026-01-01T00:00:00.000Z',
    actorType: 'admin',
    actorId: 'admin-uid',
    changes: [{ path: 'status', before: 'draft', after: 'locked' }],
    summary: null,
    ...overrides,
  }
}

export function retreatDraft(overrides: Partial<Retreat> = {}): Retreat {
  return {
    id: 'r1',
    type: 'giao_doan',
    orgUnitId: 'gd-i',
    name: 'Khoa',
    diaDiem: 'TX',
    noiDung: 'n',
    doiTuongThamDu: 't',
    thoiGianBatDau: '2026-08-01T00:00:00.000Z',
    thoiGianKetThuc: '2026-08-07T00:00:00.000Z',
    dangKyMoTu: '2026-07-01T00:00:00.000Z',
    dangKyDongLuc: '2026-07-20T00:00:00.000Z',
    extraFields: [],
    quyenDangKy: 'both',
    status: 'draft',
    createdBy: 'gd-admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export const RETREAT_ID = 'r-open'

export function registrationDraft(
  overrides: Partial<RetreatRegistration> = {},
): RetreatRegistration {
  const base: RetreatRegistration = {
    id: '',
    retreatId: RETREAT_ID,
    memberId: MEMBER_ID,
    orgUnitId: 'gd-i',
    registeredVia: 'self',
    registeredBy: null,
    extraAnswers: {},
    status: 'pending',
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  return { ...base, id: overrides.id ?? `${base.retreatId}_${base.memberId}` }
}
