async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; code?: string }
    if (body.code) return body.code
    if (body.error) return body.error
  } catch {
    // ignore JSON parse errors
  }
  return `Request failed (${response.status})`
}

export async function grantDirectoryRole(input: {
  memberId: string
  role: 'giao_doan_admin' | 'he_phai_secretary'
  idToken: string
}): Promise<{
  memberId: string
  directoryAuthUid: string
  orgUnitId: string
  email: string
}> {
  const response = await fetch('/api/admin/directory-role/grant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.idToken}`,
    },
    body: JSON.stringify({ memberId: input.memberId, role: input.role }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  return (await response.json()) as {
    memberId: string
    directoryAuthUid: string
    orgUnitId: string
    email: string
  }
}

export async function revokeDirectoryRole(input: {
  memberId: string
  idToken: string
}): Promise<{ memberId: string }> {
  const response = await fetch('/api/admin/directory-role/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.idToken}`,
    },
    body: JSON.stringify({ memberId: input.memberId }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  return (await response.json()) as { memberId: string }
}
