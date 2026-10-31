import { DomainError } from '#/domain/errors'
import type { AuditActor } from '#/domain/auditLog'
import {
  type DocumentSide,
  type DocumentTypeId,
  type MemberDocuments,
} from '#/domain/memberDocumentTypes'
import { normalizeCccd } from '#/domain/normalize'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type DeleteMemberDocumentInput = {
  memberId: string
  cccd: string
  typeId: DocumentTypeId
  side?: DocumentSide
  current: MemberDocuments
  /** Staff only: a filler cannot remove documents of a locked member. */
  idToken?: string
  audit: AuditActor
}

export type DeleteMemberDocumentResult = {
  documents: MemberDocuments
}

export async function deleteMemberDocument(
  input: DeleteMemberDocumentInput,
  memberStore: MemberStore = memberRepo,
): Promise<DeleteMemberDocumentResult> {
  const cccd = normalizeCccd(input.cccd)
  const member = await memberStore.getById(input.memberId)

  if (!member) {
    throw new DomainError('NOT_FOUND', 'Member not found')
  }

  if (member.cccd !== cccd) {
    throw new DomainError('FORBIDDEN', 'CCCD does not match member')
  }

  if (member.status === 'locked' && !input.idToken) {
    throw new DomainError('RECORD_LOCKED', 'Member is locked')
  }

  // The data API deletes the removed files.
  const updated = await memberStore.removeDocumentPaths(
    input.memberId,
    input.typeId,
    input.side,
    input.audit,
  )

  return { documents: updated.documents ?? {} }
}
