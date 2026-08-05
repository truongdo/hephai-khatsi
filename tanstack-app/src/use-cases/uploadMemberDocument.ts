import { DomainError } from '#/domain/errors'
import type { AuditActor } from '#/domain/auditLog'
import {
  getDocumentType,
  isValidDocumentSide,
  MEMBER_DOCUMENT_CONTENT_TYPES,
  MEMBER_DOCUMENT_MAX_BYTES,
  type DocumentSide,
  type DocumentTypeId,
  type MemberDocuments,
} from '#/domain/memberDocumentTypes'
import { normalizeCccd } from '#/domain/normalize'
import {
  deleteMemberDocumentObjects,
  requestMemberDocumentUploadUrl,
} from '#/photos/docsApiClient'
import { putToPresignedUrl } from '#/photos/photosApiClient'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type DocumentStoragePort = {
  put(
    memberId: string,
    cccd: string,
    typeId: DocumentTypeId,
    side: DocumentSide,
    bytes: Uint8Array,
    contentType: string,
    inviteToken?: string,
    idToken?: string,
  ): Promise<string>
}

export type UploadMemberDocumentInput = {
  memberId: string
  cccd: string
  typeId: DocumentTypeId
  side: DocumentSide
  bytes: Uint8Array
  contentType: string
  inviteToken?: string
  idToken?: string
  current: MemberDocuments
  audit: AuditActor
}

export type UploadMemberDocumentResult = {
  filePath: string
  documents: MemberDocuments
}

const allowedContentTypes = new Set<string>(MEMBER_DOCUMENT_CONTENT_TYPES)

const clientStorage: DocumentStoragePort = {
  async put(
    memberId,
    cccd,
    typeId,
    side,
    bytes,
    contentType,
    inviteToken,
    idToken,
  ) {
    const { uploadUrl, filePath } = await requestMemberDocumentUploadUrl({
      memberId,
      cccd,
      typeId,
      side,
      contentType,
      inviteToken,
      idToken,
    })
    await putToPresignedUrl(uploadUrl, bytes, contentType)
    return filePath
  },
}

export async function uploadMemberDocument(
  input: UploadMemberDocumentInput,
  memberStore: MemberStore = memberRepo,
  storage: DocumentStoragePort = clientStorage,
  deleteObjects: typeof deleteMemberDocumentObjects = deleteMemberDocumentObjects,
): Promise<UploadMemberDocumentResult> {
  const cccd = normalizeCccd(input.cccd)
  const member = await memberStore.getById(input.memberId)

  if (!member) {
    throw new DomainError('NOT_FOUND', 'Member not found')
  }

  if (member.cccd !== cccd) {
    throw new DomainError('FORBIDDEN', 'CCCD does not match member')
  }

  if (
    member.status === 'locked' &&
    !input.idToken &&
    !input.inviteToken?.trim()
  ) {
    throw new DomainError('RECORD_LOCKED', 'Member is locked')
  }

  const docType = getDocumentType(input.typeId)
  if (!docType || !isValidDocumentSide(docType, input.side)) {
    throw new DomainError('INVALID_INPUT', 'Invalid document type or side')
  }

  if (!allowedContentTypes.has(input.contentType)) {
    throw new DomainError('INVALID_INPUT', 'Invalid content type')
  }

  if (input.bytes.byteLength > MEMBER_DOCUMENT_MAX_BYTES) {
    throw new DomainError('INVALID_INPUT', 'File exceeds maximum size')
  }

  const filePath = await storage.put(
    input.memberId,
    cccd,
    input.typeId,
    input.side,
    input.bytes,
    input.contentType,
    input.inviteToken,
    input.idToken,
  )

  const { member: updated, previousPath } = await memberStore.mergeDocumentSide(
    input.memberId,
    input.typeId,
    input.side,
    filePath,
    input.audit,
  )

  if (previousPath && previousPath !== filePath) {
    try {
      await deleteObjects({
        memberId: input.memberId,
        typeId: input.typeId,
        paths: [previousPath],
        cccd,
        inviteToken: input.inviteToken,
        idToken: input.idToken,
      })
    } catch {
      // best-effort cleanup of replaced object
    }
  }

  return { filePath, documents: updated.documents ?? {} }
}
