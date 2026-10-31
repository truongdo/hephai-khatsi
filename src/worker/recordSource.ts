import { usesD1, type Env } from './env'
import {
  getMemberDocument,
  getTempleDocument,
  inviteExists,
  type WorkerMember,
  type WorkerTemple,
} from './firestoreRest'
import {
  getMemberAdminFields,
  listSecretaries,
  patchMemberDirectoryFields,
  type MemberAdminFields,
  type MemberDirectoryPatchFields,
  type SecretaryListItem,
} from './firestoreAdminRest'

// The records the photo, document and search routes check before acting, and
// the member fields the directory-role route reads and writes: from Firestore
// until the cutover, from D1 once DATA_BACKEND is `d1` (they must read the
// same database as the client).

export type RecordSource = {
  getMember(memberId: string): Promise<WorkerMember | null>
  getTemple(templeId: string): Promise<WorkerTemple | null>
  inviteExists(inviteId: string): Promise<boolean>
}

export type DirectoryMemberSource = {
  getMemberAdminFields(memberId: string): Promise<MemberAdminFields | null>
  listSecretaries(): Promise<SecretaryListItem[]>
  patchMemberDirectoryFields(memberId: string, fields: MemberDirectoryPatchFields): Promise<void>
}

export function recordSource(env: Env): RecordSource {
  if (usesD1(env)) return d1RecordSource(env.DB)
  const projectId = env.FIREBASE_PROJECT_ID
  return {
    getMember: (memberId) => getMemberDocument(projectId, memberId),
    getTemple: (templeId) => getTempleDocument(projectId, templeId),
    inviteExists: (inviteId) => inviteExists(projectId, inviteId),
  }
}

/** `accessToken` is the service account's (Firestore REST); D1 needs none. */
export function directoryMemberSource(env: Env, accessToken: string): DirectoryMemberSource {
  if (usesD1(env)) return d1DirectoryMemberSource(env.DB)
  const projectId = env.FIREBASE_PROJECT_ID
  return {
    getMemberAdminFields: (memberId) => getMemberAdminFields(accessToken, projectId, memberId),
    listSecretaries: () => listSecretaries(accessToken, projectId),
    patchMemberDirectoryFields: (memberId, fields) =>
      patchMemberDirectoryFields(accessToken, projectId, memberId, fields),
  }
}

export function d1RecordSource(db: D1Database): RecordSource {
  return {
    async getMember(memberId) {
      const row = await db
        .prepare(
          "SELECT id, org_unit_id, cccd, status, json_extract(data, '$.photoPath') AS photo_path FROM members WHERE id = ?",
        )
        .bind(memberId)
        .first<{ id: string; org_unit_id: string; cccd: string; status: WorkerMember['status']; photo_path: string | null }>()
      return row
        ? { id: row.id, orgUnitId: row.org_unit_id, cccd: row.cccd, status: row.status, photoPath: row.photo_path }
        : null
    },
    async getTemple(templeId) {
      const row = await db
        .prepare(
          "SELECT id, org_unit_id, status, json_extract(data, '$.photoPath') AS photo_path FROM temples WHERE id = ?",
        )
        .bind(templeId)
        .first<{ id: string; org_unit_id: string; status: WorkerTemple['status']; photo_path: string | null }>()
      return row
        ? { id: row.id, orgUnitId: row.org_unit_id, status: row.status, photoPath: row.photo_path }
        : null
    },
    async inviteExists(inviteId) {
      return (await db.prepare('SELECT 1 FROM invites WHERE id = ?').bind(inviteId).first()) !== null
    },
  }
}

type DirectoryMemberRow = {
  id: string
  org_unit_id: string
  email: string | null
  directory_role: string | null
  directory_auth_uid: string | null
  phap_danh: string | null
  the_danh: string | null
  directory_role_granted_at: string | null
}

const DIRECTORY_MEMBER_COLUMNS = `id, org_unit_id, directory_role, directory_auth_uid,
  json_extract(data, '$.email') AS email,
  json_extract(data, '$.phapDanh') AS phap_danh,
  json_extract(data, '$.theDanh') AS the_danh,
  json_extract(data, '$.directoryRoleGrantedAt') AS directory_role_granted_at`

/** JSON fields of `data` the directory-role route patches (the others are columns). */
const DATA_PATCH_FIELDS = ['directoryRoleGrantedAt', 'directoryRoleGrantedBy'] as const

export function d1DirectoryMemberSource(db: D1Database): DirectoryMemberSource {
  return {
    async getMemberAdminFields(memberId) {
      const row = await db
        .prepare(`SELECT ${DIRECTORY_MEMBER_COLUMNS} FROM members WHERE id = ?`)
        .bind(memberId)
        .first<DirectoryMemberRow>()
      if (!row?.email) return null
      return {
        id: row.id,
        orgUnitId: row.org_unit_id,
        email: row.email,
        directoryRole: row.directory_role,
        directoryAuthUid: row.directory_auth_uid,
      }
    },
    async listSecretaries() {
      const { results } = await db
        .prepare(
          `SELECT ${DIRECTORY_MEMBER_COLUMNS} FROM members WHERE directory_role IN ('giao_doan_admin', 'he_phai_secretary')`,
        )
        .all<DirectoryMemberRow>()
      return results.flatMap((row) => {
        if (!row.email) return []
        const item: SecretaryListItem = { id: row.id, orgUnitId: row.org_unit_id, email: row.email }
        if (row.phap_danh) item.phapDanh = row.phap_danh
        if (row.the_danh) item.theDanh = row.the_danh
        if (row.directory_role_granted_at) item.directoryRoleGrantedAt = row.directory_role_granted_at
        return [item]
      })
    },
    // A service write outside the data API (no authz, no audit), like the
    // Firestore REST patch it replaces; the version bump fences concurrent saves.
    async patchMemberDirectoryFields(memberId, fields) {
      const assignments: string[] = []
      const params: Array<string | null> = []
      if ('directoryRole' in fields) {
        assignments.push('directory_role = ?')
        params.push(fields.directoryRole ?? null)
      }
      if ('directoryAuthUid' in fields) {
        assignments.push('directory_auth_uid = ?')
        params.push(fields.directoryAuthUid ?? null)
      }
      let data = 'data'
      for (const field of DATA_PATCH_FIELDS) {
        if (!(field in fields)) continue
        data = `json_set(${data}, '$.${field}', ?)`
        params.push(fields[field] ?? null)
      }
      if (data !== 'data') assignments.push(`data = ${data}`)
      if (assignments.length === 0) return
      const result = await db
        .prepare(`UPDATE members SET ${assignments.join(', ')}, version = version + 1 WHERE id = ?`)
        .bind(...params, memberId)
        .run()
      if (result.meta.changes === 0) throw new Error(`D1 patch member failed: ${memberId} not found`)
    },
  }
}
