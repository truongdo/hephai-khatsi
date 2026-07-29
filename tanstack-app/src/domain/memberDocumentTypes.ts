export type DocumentTypeId =
  | 'cccd'
  | 'chung_nhan_tang_ni'
  | 'diep_sa_di'
  | 'diep_thuc_xoa'
  | 'diep_ty_kheo'
  | 'qd_tru_tri'
  | 'qd_giao_pham'
  | 'qd_chuc_vu_gh'

export type DocumentSideMode = 'frontBack' | 'single'
export type DocumentSide = 'front' | 'back' | 'file'

export type MemberDocumentTypeDef = {
  id: DocumentTypeId
  sides: DocumentSideMode
}

export type MemberDocumentFiles = {
  frontPath?: string
  backPath?: string
  filePath?: string
}

export type MemberDocuments = Partial<Record<DocumentTypeId, MemberDocumentFiles>>

export const MEMBER_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

export const MEMBER_DOCUMENT_CONTENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
] as const

export const MEMBER_DOCUMENT_TYPES: readonly MemberDocumentTypeDef[] = [
  { id: 'cccd', sides: 'frontBack' },
  { id: 'chung_nhan_tang_ni', sides: 'frontBack' },
  { id: 'diep_sa_di', sides: 'single' },
  { id: 'diep_thuc_xoa', sides: 'single' },
  { id: 'diep_ty_kheo', sides: 'single' },
  { id: 'qd_tru_tri', sides: 'single' },
  { id: 'qd_giao_pham', sides: 'single' },
  { id: 'qd_chuc_vu_gh', sides: 'single' },
] as const

const byId = new Map(MEMBER_DOCUMENT_TYPES.map((t) => [t.id, t]))

export function getDocumentType(id: string): MemberDocumentTypeDef | undefined {
  return byId.get(id as DocumentTypeId)
}

export function isValidDocumentSide(
  type: MemberDocumentTypeDef,
  side: string,
): side is DocumentSide {
  if (type.sides === 'frontBack') return side === 'front' || side === 'back'
  return side === 'file'
}

export function pathFieldForSide(
  side: DocumentSide,
): 'frontPath' | 'backPath' | 'filePath' {
  if (side === 'front') return 'frontPath'
  if (side === 'back') return 'backPath'
  return 'filePath'
}

export function mergeDocumentPath(
  current: MemberDocuments,
  typeId: DocumentTypeId,
  side: DocumentSide,
  filePath: string,
): MemberDocuments {
  const pathField = pathFieldForSide(side)
  const typeFiles = current[typeId] ?? {}
  return {
    ...current,
    [typeId]: {
      ...typeFiles,
      [pathField]: filePath,
    },
  }
}

export function pathsFromTypeFiles(files: MemberDocumentFiles): string[] {
  return [files.frontPath, files.backPath, files.filePath].filter(
    (path): path is string => Boolean(path),
  )
}

export function removeDocumentSide(
  current: MemberDocuments,
  typeId: DocumentTypeId,
  side: DocumentSide,
): MemberDocuments {
  const typeFiles = current[typeId]
  if (!typeFiles) return current

  const pathField = pathFieldForSide(side)
  const { [pathField]: _removed, ...rest } = typeFiles
  const next = { ...current }
  if (Object.keys(rest).length === 0) {
    delete next[typeId]
  } else {
    next[typeId] = rest
  }
  return next
}

export function removeDocumentType(
  current: MemberDocuments,
  typeId: DocumentTypeId,
): MemberDocuments {
  const { [typeId]: _removed, ...rest } = current
  return rest
}

export function extForContentType(contentType: string): 'jpg' | 'png' | 'pdf' {
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') return 'jpg'
  if (contentType === 'image/png') return 'png'
  if (contentType === 'application/pdf') return 'pdf'
  throw new Error(`Unsupported content type: ${contentType}`)
}

export function memberDocumentObjectKey(
  memberId: string,
  typeId: DocumentTypeId,
  side: DocumentSide,
  contentType: string,
): string {
  const ext = extForContentType(contentType)
  return `members/${memberId}/docs/${typeId}/${side}.${ext}`
}
