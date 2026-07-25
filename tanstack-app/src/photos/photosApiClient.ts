async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (body.error) return body.error
  } catch {
    // ignore JSON parse errors
  }
  return `Request failed (${response.status})`
}

export async function requestMemberPhotoUploadUrl(input: {
  memberId: string
  cccd: string
  contentType: string
  inviteToken?: string
  idToken?: string
}): Promise<{ uploadUrl: string; photoPath: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (input.idToken) {
    headers.Authorization = `Bearer ${input.idToken}`
  }

  const body: Record<string, string> = {
    memberId: input.memberId,
    cccd: input.cccd,
    contentType: input.contentType,
  }
  if (input.inviteToken) {
    body.inviteToken = input.inviteToken
  }

  const response = await fetch('/api/photos/member-upload-url', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  return (await response.json()) as { uploadUrl: string; photoPath: string }
}

export async function putToPresignedUrl(
  uploadUrl: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: bytes,
    headers: { 'Content-Type': contentType },
  })

  if (!response.ok) {
    throw new Error(`Photo upload failed (${response.status})`)
  }
}

export async function deleteMemberPhotoObject(input: {
  memberId: string
  idToken: string
}): Promise<void> {
  const response = await fetch('/api/photos/member', {
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

export async function requestTemplePhotoUploadUrl(input: {
  templeId: string
  contentType: string
  inviteToken?: string
  idToken?: string
}): Promise<{ uploadUrl: string; photoPath: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (input.idToken) {
    headers.Authorization = `Bearer ${input.idToken}`
  }

  const body: Record<string, string> = {
    templeId: input.templeId,
    contentType: input.contentType,
  }
  if (input.inviteToken) {
    body.inviteToken = input.inviteToken
  }

  const response = await fetch('/api/photos/temple-upload-url', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  return (await response.json()) as { uploadUrl: string; photoPath: string }
}

export async function deleteTemplePhotoObject(input: {
  templeId: string
  idToken: string
}): Promise<void> {
  const response = await fetch('/api/photos/temple', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.idToken}`,
    },
    body: JSON.stringify({ templeId: input.templeId }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }
}
