export type WorkerMember = {
  id: string
  orgUnitId: string
  cccd: string
  status: 'draft' | 'locked'
}

type FirestoreValue = {
  stringValue?: string
}

type FirestoreDocument = {
  fields?: Record<string, FirestoreValue>
}

function firestoreDocUrl(
  projectId: string,
  collection: string,
  docId: string,
): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`
}

function parseStringField(doc: FirestoreDocument, field: string): string | null {
  return doc.fields?.[field]?.stringValue ?? null
}

async function fetchFirestoreDocument(
  projectId: string,
  collection: string,
  docId: string,
): Promise<FirestoreDocument | null> {
  const res = await fetch(firestoreDocUrl(projectId, collection, docId))
  if (res.status === 404) return null
  if (!res.ok) return null
  return (await res.json()) as FirestoreDocument
}

export async function getMemberDocument(
  projectId: string,
  memberId: string,
): Promise<WorkerMember | null> {
  const doc = await fetchFirestoreDocument(projectId, 'members', memberId)
  if (!doc) return null

  const orgUnitId = parseStringField(doc, 'orgUnitId')
  const cccd = parseStringField(doc, 'cccd')
  const status = parseStringField(doc, 'status')
  if (!orgUnitId || !cccd || (status !== 'draft' && status !== 'locked')) {
    return null
  }

  return {
    id: memberId,
    orgUnitId,
    cccd,
    status,
  }
}

export async function getInviteOrgUnitId(
  projectId: string,
  inviteId: string,
): Promise<string | null> {
  const doc = await fetchFirestoreDocument(projectId, 'invites', inviteId)
  if (!doc) return null
  return parseStringField(doc, 'orgUnitId')
}
