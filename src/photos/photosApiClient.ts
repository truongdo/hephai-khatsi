// Client of the Worker's upload routes (src/worker/photosApi.ts,
// src/worker/docsApi.ts): a multipart POST of the record's fields and the
// file; staff send their Firebase ID token, fillers the invite token.

export type UploadAuth = {
  inviteToken?: string
  idToken?: string
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (body.error) return body.error
  } catch {
    // ignore JSON parse errors
  }
  return `Request failed (${response.status})`
}

export async function postUpload<T>(
  url: string,
  fields: Record<string, string>,
  file: { bytes: Uint8Array; contentType: string },
  auth: UploadAuth,
): Promise<T> {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.append(name, value)
  if (auth.inviteToken) form.append('inviteToken', auth.inviteToken)
  form.append('file', new Blob([file.bytes], { type: file.contentType }))
  const response = await fetch(url, {
    method: 'POST',
    headers: auth.idToken ? { Authorization: `Bearer ${auth.idToken}` } : {},
    body: form,
  })
  if (!response.ok) {
    throw new Error(await readApiError(response))
  }
  return (await response.json()) as T
}

export function uploadMemberPhotoFile(
  input: { memberId: string; cccd: string; bytes: Uint8Array; contentType: string } & UploadAuth,
): Promise<{ photoPath: string }> {
  return postUpload(
    '/api/photos/member',
    { memberId: input.memberId, cccd: input.cccd },
    input,
    input,
  )
}

export function uploadTemplePhotoFile(
  input: { templeId: string; bytes: Uint8Array; contentType: string } & UploadAuth,
): Promise<{ photoPath: string }> {
  return postUpload('/api/photos/temple', { templeId: input.templeId }, input, input)
}
