import type { MemberDocumentFiles, MemberDocuments } from './memberDocumentTypes'
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

export const memberPhotoKey = (memberId: string): string => `${memberFolder(memberId)}photo.jpg`
export const templePhotoKey = (templeId: string): string => `${templeFolder(templeId)}photo.jpg`
