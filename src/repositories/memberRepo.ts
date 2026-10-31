import type { AuditActor } from '#/domain/auditLog'
import type {
  DocumentSide,
  DocumentTypeId,
  MemberDocuments,
} from '#/domain/memberDocumentTypes'
import type { MemberTinhTrang } from '#/domain/memberTinhTrang'
import type { Member, SanghaType } from '#/domain/types'
import type {
  AdminListPage,
  CountMembersByHaLapTabInput,
  ListMembersAdminInput,
  ListMembersByHaLapTabInput,
  ListMembersExportInput,
} from '#/repositories/adminListTypes'
import { d1MemberRepo } from '#/repositories/d1/memberRepo'

export type MemberProfilePatch = Partial<
  Omit<
    Member,
    | 'id'
    | 'orgUnitId'
    | 'sanghaType'
    | 'status'
    | 'cccd'
    | 'inviteId'
    | 'createdAt'
    | 'updatedAt'
    | 'lockedAt'
    | 'lockedBy'
    | 'orgUnitName'
    | 'giaoPhamHePhaiRankOrder'
    | 'sapXepHaLap'
    | 'haLapTabRank'
    | 'tinhTrang'
  >
>

export type CreateOrUpdateMemberDraftInput = {
  orgUnitId: string
  sanghaType: SanghaType
  inviteId: string | null
  cccd: string
  patch: MemberProfilePatch
  audit?: AuditActor
}

export type CreateOrUpdateMemberAndLockInput = CreateOrUpdateMemberDraftInput & {
  audit: AuditActor
}

export type MemberLookupInput = {
  orgUnitId: string
  sanghaType: SanghaType
  cccd: string
}

export type MemberPhoneLookupInput = {
  orgUnitId: string
  sanghaType: SanghaType
  phone: string
  /** The filler's invite; required unless the caller is staff. */
  inviteToken?: string
}

export type MemberStore = {
  createOrUpdateDraft(
    input: CreateOrUpdateMemberDraftInput,
  ): Promise<{ member: Member; mode: 'created' | 'updated' }>
  createOrUpdateAndLock(
    input: CreateOrUpdateMemberAndLockInput,
  ): Promise<{ member: Member; mode: 'created' | 'updated' }>
  requestEdit(memberId: string, phone: string): Promise<Member>
  updateDraftById(
    memberId: string,
    patch: MemberProfilePatch,
    options?: {
      allowWhenLocked?: boolean
      allowOrgUnitChange?: boolean
      orgUnitId?: string
      audit?: AuditActor
    },
  ): Promise<Member>
  getByCccd(input: MemberLookupInput): Promise<Member | null>
  getById(memberId: string): Promise<Member | null>
  listByOrgSanghaAndPhone(input: MemberPhoneLookupInput): Promise<Member[]>
  list(input: ListMembersAdminInput): Promise<AdminListPage<Member>>
  listByHaLapTab(input: ListMembersByHaLapTabInput): Promise<AdminListPage<Member>>
  countByHaLapTab(input: CountMembersByHaLapTabInput): Promise<number>
  listAllForExport(input: ListMembersExportInput): Promise<Member[]>
  listByCurrentTempleIds(templeIds: string[]): Promise<Member[]>
  deleteMany(ids: string[]): Promise<void>
  setPhotoPath(
    memberId: string,
    photoPath: string | null,
    audit: AuditActor,
  ): Promise<Member>
  setDocumentPaths(memberId: string, documents: MemberDocuments): Promise<Member>
  setTinhTrang(
    memberId: string,
    tinhTrang: MemberTinhTrang | null,
    audit: AuditActor,
  ): Promise<Member>
  mergeDocumentSide(
    memberId: string,
    typeId: DocumentTypeId,
    side: DocumentSide,
    filePath: string,
    audit: AuditActor,
  ): Promise<{ member: Member; previousPath?: string }>
  removeDocumentPaths(
    memberId: string,
    typeId: DocumentTypeId,
    side: DocumentSide | undefined,
    audit: AuditActor,
  ): Promise<{ member: Member; removedPaths: string[] }>
  lock(memberId: string, lockedBy: string, audit: AuditActor): Promise<Member>
  unlock(memberId: string, audit: AuditActor): Promise<Member>
  listDirectorySecretaries(): Promise<Member[]>
  listHePhaiSecretaries(): Promise<Member[]>
}

export const memberRepo: MemberStore = d1MemberRepo
