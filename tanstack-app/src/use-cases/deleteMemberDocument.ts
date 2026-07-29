import { DomainError } from '#/domain/errors'
import {
  type DocumentSide,
  type DocumentTypeId,
  type MemberDocuments,
} from '#/domain/memberDocumentTypes'
import { normalizeCccd } from '#/domain/normalize'
import { deleteMemberDocumentObjects } from '#/photos/docsApiClient'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type DeleteMemberDocumentInput = {
  memberId: string
  cccd: string
  typeId: DocumentTypeId
  side?: DocumentSide
  current: MemberDocuments
  inviteToken?: string
  idToken?: string
}

export type DeleteMemberDocumentResult = {
  documents: MemberDocuments
}

export async function deleteMemberDocument(
  input: DeleteMemberDocumentInput,
  memberStore: MemberStore = memberRepo,
  deleteObjects: typeof deleteMemberDocumentObjects = deleteMemberDocumentObjects,
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

  const { member: updated, removedPaths } = await memberStore.removeDocumentPaths(
    input.memberId,
    input.typeId,
    input.side,
  )

  if (removedPaths.length > 0) {
    await deleteObjects({
      memberId: input.memberId,
      typeId: input.typeId,
      paths: removedPaths,
      cccd,
      inviteToken: input.inviteToken,
      idToken: input.idToken,
    })
  }

  return { documents: updated.documents ?? {} }
}
