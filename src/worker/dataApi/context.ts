import type { Caller } from '#/domain/authz/caller'
import type { Member, Temple } from '#/domain/types'

/**
 * Typesense updates after a write. They run after the response
 * (`ctx.waitUntil`) and never fail the save.
 */
export type SearchSync = {
  upsertMember(member: Member): void
  upsertTemple(temple: Temple): void
  deleteMember(id: string): void
  deleteTemple(id: string): void
}

/** The R2 objects (portraits, member documents) records reference. */
export type RecordFiles = {
  /** Copies an object; awaited before the write that references `to`. A missing source is skipped. */
  copy(from: string, to: string): Promise<void>
  /** Deletes objects a committed write stopped referencing, after the response. */
  deleteLater(paths: string[]): void
}

/** What a data API handler gets besides its input. */
export type DataContext = {
  db: D1Database
  caller: Caller
  /** ISO timestamp of the request (one clock for the whole write). */
  now: string
  search: SearchSync
  files: RecordFiles
}
