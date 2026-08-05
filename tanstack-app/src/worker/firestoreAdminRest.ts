type FirestoreStringValue = { stringValue: string }
type FirestoreNullValue = { nullValue: null }
type FirestoreValue = FirestoreStringValue | FirestoreNullValue

type FirestoreDocument = {
  name?: string
  fields?: Record<string, FirestoreValue>
}

type RunQueryResult = {
  document?: FirestoreDocument
}

export type MemberAdminFields = {
  id: string
  orgUnitId: string
  email: string
  directoryRole: string | null
  directoryAuthUid: string | null
}

export type SecretaryListItem = {
  id: string
  orgUnitId: string
  email: string
  phapDanh?: string
  theDanh?: string
  directoryRoleGrantedAt?: string
}

export type MemberDirectoryPatchFields = {
  directoryRole?: string | null
  directoryAuthUid?: string | null
  directoryRoleGrantedAt?: string | null
  directoryRoleGrantedBy?: string | null
}

function memberDocUrl(projectId: string, memberId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/members/${memberId}`
}

function runQueryUrl(projectId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

function parseStringField(
  doc: FirestoreDocument,
  field: string,
): string | null {
  const value = doc.fields?.[field]
  if (!value) return null
  if ('stringValue' in value) return value.stringValue
  return null
}

function parseDocId(doc: FirestoreDocument): string | null {
  const name = doc.name
  if (!name) return null
  const parts = name.split('/')
  return parts[parts.length - 1] ?? null
}

function toFirestoreValue(value: string | null): FirestoreValue {
  if (value === null) return { nullValue: null }
  return { stringValue: value }
}

export async function getMemberAdminFields(
  accessToken: string,
  projectId: string,
  memberId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MemberAdminFields | null> {
  const res = await fetchImpl(memberDocUrl(projectId, memberId), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`Firestore get member failed: ${res.status}`)
  }

  const doc = (await res.json()) as FirestoreDocument
  const orgUnitId = parseStringField(doc, 'orgUnitId')
  const email = parseStringField(doc, 'email')
  if (!orgUnitId || !email) return null

  return {
    id: memberId,
    orgUnitId,
    email,
    directoryRole: parseStringField(doc, 'directoryRole'),
    directoryAuthUid: parseStringField(doc, 'directoryAuthUid'),
  }
}

export async function listSecretaries(
  accessToken: string,
  projectId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SecretaryListItem[]> {
  const res = await fetchImpl(runQueryUrl(projectId), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'members' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'directoryRole' },
            op: 'EQUAL',
            value: { stringValue: 'giao_doan_admin' },
          },
        },
      },
    }),
  })

  if (!res.ok) {
    throw new Error(`Firestore runQuery failed: ${res.status}`)
  }

  const rows = (await res.json()) as RunQueryResult[]
  const secretaries: SecretaryListItem[] = []

  for (const row of rows) {
    const doc = row.document
    if (!doc) continue

    const id = parseDocId(doc)
    const orgUnitId = parseStringField(doc, 'orgUnitId')
    const email = parseStringField(doc, 'email')
    if (!id || !orgUnitId || !email) continue

    const item: SecretaryListItem = { id, orgUnitId, email }
    const phapDanh = parseStringField(doc, 'phapDanh')
    const theDanh = parseStringField(doc, 'theDanh')
    const directoryRoleGrantedAt = parseStringField(
      doc,
      'directoryRoleGrantedAt',
    )
    if (phapDanh) item.phapDanh = phapDanh
    if (theDanh) item.theDanh = theDanh
    if (directoryRoleGrantedAt) {
      item.directoryRoleGrantedAt = directoryRoleGrantedAt
    }
    secretaries.push(item)
  }

  return secretaries
}

export async function patchMemberDirectoryFields(
  accessToken: string,
  projectId: string,
  memberId: string,
  fields: MemberDirectoryPatchFields,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const fieldPaths = Object.keys(fields)
  if (fieldPaths.length === 0) return

  const updateMask = fieldPaths
    .map((path) => `updateMask.fieldPaths=${encodeURIComponent(path)}`)
    .join('&')
  const url = `${memberDocUrl(projectId, memberId)}?${updateMask}`

  const firestoreFields = Object.fromEntries(
    fieldPaths.map((path) => [
      path,
      toFirestoreValue(fields[path as keyof MemberDirectoryPatchFields] ?? null),
    ]),
  )

  const res = await fetchImpl(url, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ fields: firestoreFields }),
  })

  if (!res.ok) {
    throw new Error(`Firestore patch member failed: ${res.status}`)
  }
}
