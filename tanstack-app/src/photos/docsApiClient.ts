import type { DocumentSide, DocumentTypeId } from '#/domain/memberDocumentTypes'

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (body.error) return body.error
  } catch {
    // ignore JSON parse errors
  }
  return `Request failed (${response.status})`
}

export async function requestMemberDocumentUploadUrl(input: {
  memberId: string
  cccd: string
  typeId: DocumentTypeId
  side: DocumentSide
  contentType: string
  inviteToken?: string
  idToken?: string
}): Promise<{ uploadUrl: string; filePath: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (input.idToken) {
    headers.Authorization = `Bearer ${input.idToken}`
  }

  const body: Record<string, string> = {
    memberId: input.memberId,
    cccd: input.cccd,
    typeId: input.typeId,
    side: input.side,
    contentType: input.contentType,
  }
  if (input.inviteToken) {
    body.inviteToken = input.inviteToken
  }

  const response = await fetch('/api/docs/member-upload-url', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  return (await response.json()) as { uploadUrl: string; filePath: string }
}

export async function deleteMemberDocumentObjects(input: {
  memberId: string
  typeId: DocumentTypeId
  paths: string[]
  cccd?: string
  inviteToken?: string
  idToken?: string
}): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (input.idToken) {
    headers.Authorization = `Bearer ${input.idToken}`
  }

  const body: Record<string, unknown> = {
    memberId: input.memberId,
    typeId: input.typeId,
    paths: input.paths,
  }
  if (input.cccd) body.cccd = input.cccd
  if (input.inviteToken) body.inviteToken = input.inviteToken

  const response = await fetch('/api/docs/member', {
    method: 'DELETE',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }
}

export async function deleteMemberDocumentsPrefix(input: {
  memberId: string
  idToken: string
}): Promise<void> {
  const response = await fetch('/api/docs/member-prefix', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.idToken}`,
    },
    body: JSON.stringify({ memberId: input.memberId }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }
}
