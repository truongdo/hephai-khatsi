const IDENTITY_TOOLKIT_BASE = 'https://identitytoolkit.googleapis.com/v1'

type IdentityToolkitUser = {
  localId?: string
  customAttributes?: string
}

function parseCustomAttributes(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

type LookupResponse = {
  users?: IdentityToolkitUser[]
}

type SignUpResponse = {
  localId?: string
}

function projectAccountsUrl(projectId: string, action?: string): string {
  const base = `${IDENTITY_TOOLKIT_BASE}/projects/${projectId}/accounts`
  return action ? `${base}:${action}` : base
}

async function identityToolkitError(
  action: string,
  res: Response,
): Promise<never> {
  let detail = ''
  try {
    detail = (await res.text()).slice(0, 300)
  } catch {
    // ignore
  }
  throw new Error(
    `Identity Toolkit ${action} failed: ${res.status}${detail ? ` ${detail}` : ''}`,
  )
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

export async function lookupAuthUserByEmail(
  accessToken: string,
  projectId: string,
  email: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ localId: string; customClaims: Record<string, unknown> } | null> {
  const res = await fetchImpl(projectAccountsUrl(projectId, 'lookup'), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ email: [email] }),
  })

  if (res.status === 404) return null
  if (!res.ok) {
    await identityToolkitError('lookup', res)
  }

  const data = (await res.json()) as LookupResponse
  const user = data.users?.[0]
  const localId = user?.localId
  if (!localId) return null
  return {
    localId,
    customClaims: parseCustomAttributes(user?.customAttributes),
  }
}

export async function createAuthUserWithEmail(
  accessToken: string,
  projectId: string,
  email: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ localId: string }> {
  // Firebase Admin createUser uses POST .../projects/{projectId}/accounts
  // (not accounts:signUp — that project-scoped RPC 404s on Firebase Auth).
  const res = await fetchImpl(projectAccountsUrl(projectId), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      email,
      emailVerified: true,
    }),
  })

  if (!res.ok) {
    await identityToolkitError('create', res)
  }

  const data = (await res.json()) as SignUpResponse
  if (!data.localId) {
    throw new Error('Identity Toolkit create response missing localId')
  }
  return { localId: data.localId }
}

export async function setAuthCustomClaims(
  accessToken: string,
  projectId: string,
  localId: string,
  claims: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(projectAccountsUrl(projectId, 'update'), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      localId,
      customAttributes: JSON.stringify(claims),
    }),
  })

  if (!res.ok) {
    await identityToolkitError('update', res)
  }
}
