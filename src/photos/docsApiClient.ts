import type { DocumentSide, DocumentTypeId } from '#/domain/memberDocumentTypes'
import { postUpload, type UploadAuth } from './photosApiClient'

export function uploadMemberDocumentFile(
  input: {
    memberId: string
    cccd: string
    typeId: DocumentTypeId
    side: DocumentSide
    bytes: Uint8Array
    contentType: string
  } & UploadAuth,
): Promise<{ filePath: string }> {
  return postUpload(
    '/api/docs/member',
    { memberId: input.memberId, cccd: input.cccd, typeId: input.typeId, side: input.side },
    input,
    input,
  )
}
