import { DomainError } from '#/domain/errors'
import { memberCccdIndexId } from '#/domain/memberCccdIndex'
import type { Member, SanghaType, Temple } from '#/domain/types'
import type {
  AdminListPage,
  ListMembersAdminInput,
  ListTemplesAdminInput,
} from '#/repositories/adminListTypes'
import type {
  CreateOrUpdateMemberDraftInput,
  MemberProfilePatch,
  MemberStore,
} from '#/repositories/memberRepo'
import type {
  CreateOrUpdateTempleDraftInput,
  TempleStore,
} from '#/repositories/templeRepo'

function listInMemory<T extends { id: string }>(
  all: Iterable<T>,
  input: { limit?: number; cursor?: string },
  options: {
    filter: (item: T) => boolean
    sortKey: (item: T) => string
  },
): AdminListPage<T> {
  const limit = input.limit ?? 25
  let items = [...all].filter(options.filter)
  items.sort((a, b) => options.sortKey(b).localeCompare(options.sortKey(a)))

  if (input.cursor) {
    const cursorIdx = items.findIndex((item) => item.id === input.cursor)
    if (cursorIdx >= 0) {
      items = items.slice(cursorIdx + 1)
    }
  }

  const page = items.slice(0, limit)
  const nextCursor =
    items.length > limit ? page[page.length - 1]!.id : null
  return { items: page, nextCursor }
}

export function createMemoryMemberStore(
  seed: Member[] = [],
): MemberStore & {
  members: Map<string, Member>
  index: Map<string, string>
} {
  const members = new Map(seed.map((member) => [member.id, member]))
  const index = new Map<string, string>()
  for (const member of seed) {
    index.set(
      memberCccdIndexId(member.orgUnitId, member.sanghaType, member.cccd),
      member.id,
    )
  }

  const store: MemberStore & {
    members: Map<string, Member>
    index: Map<string, string>
  } = {
    members,
    index,
    async createOrUpdateDraft(input: CreateOrUpdateMemberDraftInput) {
      const indexId = memberCccdIndexId(
        input.orgUnitId,
        input.sanghaType,
        input.cccd,
      )
      const now = '2026-07-19T00:00:00.000Z'
      const existingMemberId = index.get(indexId)

      if (existingMemberId) {
        const existing = members.get(existingMemberId)
        if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
        if (existing.status === 'locked') {
          throw new DomainError('RECORD_LOCKED', 'Member is locked')
        }
        const member = {
          ...existing,
          ...input.patch,
          // Re-validated per the current invite token on every non-admin
          // write, matching memberRepo.ts / firebase/firestore.rules.
          inviteId: input.inviteId,
          updatedAt: now,
        }
        members.set(existing.id, member)
        return { member, mode: 'updated' as const }
      }

      const id = `member-${members.size + 1}`
      const member: Member = {
        id,
        orgUnitId: input.orgUnitId,
        sanghaType: input.sanghaType,
        status: 'draft',
        cccd: input.cccd,
        inviteId: input.inviteId,
        currentTempleId: null,
        photoPath: null,
        createdAt: now,
        updatedAt: now,
        lockedAt: null,
        lockedBy: null,
        ...input.patch,
      }
      members.set(id, member)
      index.set(indexId, id)
      return { member, mode: 'created' as const }
    },
    async updateDraftById(memberId: string, patch: MemberProfilePatch) {
      const existing = members.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      if (existing.status === 'locked') {
        throw new DomainError('RECORD_LOCKED', 'Member is locked')
      }
      const now = '2026-07-19T00:00:00.000Z'
      const member: Member = {
        ...existing,
        ...patch,
        id: existing.id,
        orgUnitId: existing.orgUnitId,
        sanghaType: existing.sanghaType,
        status: existing.status,
        cccd: existing.cccd,
        inviteId: existing.inviteId,
        createdAt: existing.createdAt,
        lockedAt: existing.lockedAt,
        lockedBy: existing.lockedBy,
        updatedAt: now,
      }
      members.set(memberId, member)
      return member
    },
    async getByCccd(input: {
      orgUnitId: string
      sanghaType: SanghaType
      cccd: string
    }) {
      const id = index.get(
        memberCccdIndexId(input.orgUnitId, input.sanghaType, input.cccd),
      )
      return id ? members.get(id) ?? null : null
    },
    async getById(memberId: string) {
      return members.get(memberId) ?? null
    },
    async setPhotoPath(memberId: string, photoPath: string) {
      const existing = members.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      if (existing.status === 'locked') {
        throw new DomainError('RECORD_LOCKED', 'Member is locked')
      }
      const member = {
        ...existing,
        photoPath,
        updatedAt: '2026-07-19T00:00:00.000Z',
      }
      members.set(memberId, member)
      return member
    },
    async lock(memberId: string, lockedBy: string) {
      const existing = members.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      const member: Member = {
        ...existing,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy,
        updatedAt: '2026-07-19T00:00:00.000Z',
      }
      members.set(memberId, member)
      return member
    },
    async unlock(memberId: string) {
      const existing = members.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      if (existing.status === 'draft') {
        return existing
      }
      const member: Member = {
        ...existing,
        status: 'draft',
        lockedAt: null,
        lockedBy: null,
        updatedAt: '2026-07-19T00:00:00.000Z',
      }
      members.set(memberId, member)
      return member
    },
    async list(input: ListMembersAdminInput) {
      return listInMemory(members.values(), input, {
        filter: (member) =>
          member.sanghaType === input.sanghaType &&
          (!input.orgUnitId || member.orgUnitId === input.orgUnitId) &&
          (!input.status || member.status === input.status),
        sortKey: (member) => member.updatedAt,
      })
    },
  }

  return store
}

export function createMemoryTempleStore(
  seed: Temple[] = [],
): TempleStore & {
  temples: Map<string, Temple>
} {
  const temples = new Map(seed.map((temple) => [temple.id, temple]))

  const store: TempleStore & {
    temples: Map<string, Temple>
  } = {
    temples,
    async createOrUpdateDraft(input: CreateOrUpdateTempleDraftInput) {
      const now = '2026-07-19T00:00:00.000Z'

      if (input.templeId) {
        const existing = temples.get(input.templeId)
        if (!existing) throw new DomainError('NOT_FOUND', 'Temple not found')
        if (existing.orgUnitId !== input.orgUnitId) {
          throw new DomainError(
            'FORBIDDEN',
            'Temple does not belong to this invite org unit',
          )
        }
        if (existing.status === 'locked') {
          throw new DomainError('RECORD_LOCKED', 'Temple is locked')
        }
        const temple: Temple = {
          ...existing,
          ...input.patch,
          id: existing.id,
          orgUnitId: existing.orgUnitId,
          status: 'draft',
          managerPhones: input.managerPhones,
          // Re-validated per the current invite token on non-admin writes;
          // admin writes pass inviteId: null and preserve the original,
          // matching templeRepo.ts / firebase/firestore.rules.
          inviteId: input.inviteId ?? existing.inviteId,
          createdAt: existing.createdAt,
          updatedAt: now,
          lockedAt: existing.lockedAt,
          lockedBy: existing.lockedBy,
        }
        temples.set(temple.id, temple)
        return { temple, mode: 'updated' as const }
      }

      const id = `temple-${temples.size + 1}`
      const temple: Temple = {
        ...input.patch,
        id,
        orgUnitId: input.orgUnitId,
        status: 'draft',
        managerPhones: input.managerPhones,
        inviteId: input.inviteId,
        createdAt: now,
        updatedAt: now,
        lockedAt: null,
        lockedBy: null,
      }
      temples.set(id, temple)
      return { temple, mode: 'created' as const }
    },
    async getById(templeId: string) {
      return temples.get(templeId) ?? null
    },
    async listByOrgAndPhone(input: { orgUnitId: string; phone: string }) {
      return [...temples.values()].filter(
        (temple) =>
          temple.orgUnitId === input.orgUnitId &&
          temple.managerPhones.includes(input.phone),
      )
    },
    async lock(templeId: string, lockedBy: string) {
      const existing = temples.get(templeId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Temple not found')
      const temple: Temple = {
        ...existing,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy,
        updatedAt: '2026-07-19T00:00:00.000Z',
      }
      temples.set(templeId, temple)
      return temple
    },
    async unlock(templeId: string) {
      const existing = temples.get(templeId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Temple not found')
      if (existing.status === 'draft') {
        return existing
      }
      const temple: Temple = {
        ...existing,
        status: 'draft',
        lockedAt: null,
        lockedBy: null,
        updatedAt: '2026-07-19T00:00:00.000Z',
      }
      temples.set(templeId, temple)
      return temple
    },
    async list(input: ListTemplesAdminInput) {
      return listInMemory(temples.values(), input, {
        filter: (temple) =>
          (!input.orgUnitId || temple.orgUnitId === input.orgUnitId) &&
          (!input.status || temple.status === input.status),
        sortKey: (temple) => temple.updatedAt,
      })
    },
  }

  return store
}
