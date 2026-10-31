import {
  getDocumentType,
  isValidDocumentSide,
  type DocumentSide,
  type DocumentTypeId,
  type MemberDocumentFiles,
  type MemberDocuments,
} from './memberDocumentTypes'
import type { Member, Temple } from './types'

// The R2 objects (portrait, member documents) a member or temple record
// references. The data API deletes the ones a write stops referencing, so a
// record and the bucket stay in step.

const DOCUMENT_PATH_FIELDS = ['frontPath', 'backPath', 'filePath'] as const

export function memberFilePaths(member: Pick<Member, 'photoPath' | 'documents'>): string[] {
  const paths = member.photoPath ? [member.photoPath] : []
  for (const files of Object.values(member.documents ?? {})) {
    for (const field of DOCUMENT_PATH_FIELDS) {
      const path = files?.[field]
      if (path) paths.push(path)
    }
  }
  return paths
}

export function templeFilePaths(temple: Pick<Temple, 'photoPath'>): string[] {
  return temple.photoPath ? [temple.photoPath] : []
}

export const memberFolder = (memberId: string): string => `members/${memberId}/`
export const templeFolder = (templeId: string): string => `temples/${templeId}/`

/**
 * Paths `before` references and `after` no longer does, inside the record's
 * own `folder`: a path a client set to another record's file is never
 * deleted through this record.
 */
export function droppedFiles(
  before: readonly string[],
  after: readonly string[],
  folder: string,
): string[] {
  const kept = new Set(after)
  return [...new Set(before)].filter((path) => path.startsWith(folder) && !kept.has(path))
}

/**
 * Whether every document side `before` has is still filled in `after` (its
 * path may change, e.g. a re-upload as PDF): a filler may replace a locked
 * member's documents but not remove them.
 */
export function documentSidesKept(
  before: MemberDocuments | undefined,
  after: MemberDocuments | undefined,
): boolean {
  return Object.entries(before ?? {}).every(([typeId, files]) =>
    DOCUMENT_PATH_FIELDS.every(
      (field) => !files?.[field] || Boolean(after?.[typeId as keyof MemberDocuments]?.[field]),
    ),
  )
}

export type FileMove = { from: string; to: string }

/**
 * A member moving to another org unit gets a new id; its files move from
 * `members/<oldId>/` to `members/<newId>/` so the old id (which a new member
 * may take again) owns no files of it. Paths outside the old folder stay.
 */
export function moveMemberFiles<M extends Pick<Member, 'photoPath' | 'documents'>>(
  member: M,
  oldId: string,
  newId: string,
): { member: M; moves: FileMove[] } {
  const oldPrefix = memberFolder(oldId)
  const moves: FileMove[] = []
  const move = (path: string): string => {
    if (!path.startsWith(oldPrefix)) return path
    const to = memberFolder(newId) + path.slice(oldPrefix.length)
    moves.push({ from: path, to })
    return to
  }
  const documents = member.documents
    ? Object.fromEntries(
        Object.entries(member.documents).map(([typeId, files]) => [
          typeId,
          Object.fromEntries(
            Object.entries(files ?? {}).map(([field, path]) => [field, path ? move(path) : path]),
          ) as MemberDocumentFiles,
        ]),
      )
    : member.documents
  return {
    member: {
      ...member,
      photoPath: member.photoPath ? move(member.photoPath) : member.photoPath,
      documents,
    },
    moves,
  }
}

// Upload keys carry a `version` (random, per upload): a new file never takes
// the key of the one it replaces, so deleting the old file after the
// response cannot hit the new one (and caches never serve the old image).
// Keys without a version are older uploads.

export type UploadExtension = 'jpg' | 'png' | 'pdf'

export const memberPhotoKey = (memberId: string, version: string): string =>
  `${memberFolder(memberId)}photo-${version}.jpg`
export const templePhotoKey = (templeId: string, version: string): string =>
  `${templeFolder(templeId)}photo-${version}.jpg`
export const memberDocumentKey = (
  memberId: string,
  typeId: DocumentTypeId,
  side: DocumentSide,
  extension: UploadExtension,
  version: string,
): string => `${memberFolder(memberId)}docs/${typeId}/${side}-${version}.${extension}`

const SIDE_FOR_FIELD = { frontPath: 'front', backPath: 'back', filePath: 'file' } as const

/** `<stem>[-<version>].<extension>` with an allowed extension. */
function isUploadKey(path: string, stem: string, extensions: readonly UploadExtension[]): boolean {
  if (!path.startsWith(stem)) return false
  const match = /^(?:-[A-Za-z0-9]+)?\.(jpg|png|pdf)$/.exec(path.slice(stem.length))
  return match !== null && extensions.includes(match[1] as UploadExtension)
}

/** Paths `after` references that `before` did not. */
export function addedFiles(before: readonly string[], after: readonly string[]): string[] {
  const had = new Set(before)
  return [...new Set(after)].filter((path) => !had.has(path))
}

function isMemberDocumentKey(memberId: string, typeId: string, field: string, path: string): boolean {
  const type = getDocumentType(typeId)
  const side = SIDE_FOR_FIELD[field as keyof typeof SIDE_FOR_FIELD]
  if (!type || !side || !isValidDocumentSide(type, side)) return false
  return isUploadKey(path, `${memberFolder(memberId)}docs/${typeId}/${side}`, ['jpg', 'png', 'pdf'])
}

/**
 * The paths `after` adds over `before` that are not keys the upload routes
 * write for this member (`ownerId`'s photo, or the document side they fill):
 * a client can point a record only at its own uploaded files.
 */
export function foreignMemberFiles(
  before: Pick<Member, 'photoPath' | 'documents'> | null,
  after: Pick<Member, 'photoPath' | 'documents'>,
  ownerId: string,
): string[] {
  const added = new Set(addedFiles(before ? memberFilePaths(before) : [], memberFilePaths(after)))
  const foreign: string[] = []
  if (after.photoPath && added.has(after.photoPath) && !isUploadKey(after.photoPath, `${memberFolder(ownerId)}photo`, ['jpg'])) {
    foreign.push(after.photoPath)
  }
  for (const [typeId, files] of Object.entries(after.documents ?? {})) {
    for (const [field, path] of Object.entries(files ?? {})) {
      if (typeof path === 'string' && added.has(path) && !isMemberDocumentKey(ownerId, typeId, field, path)) {
        foreign.push(path)
      }
    }
  }
  return foreign
}

/** As `foreignMemberFiles`, for a temple's photo. */
export function foreignTempleFiles(
  before: Pick<Temple, 'photoPath'> | null,
  after: Pick<Temple, 'photoPath'>,
  ownerId: string,
): string[] {
  return addedFiles(before ? templeFilePaths(before) : [], templeFilePaths(after)).filter(
    (path) => !isUploadKey(path, `${templeFolder(ownerId)}photo`, ['jpg']),
  )
}
