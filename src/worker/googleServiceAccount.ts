import * as jose from 'jose'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/identitytoolkit',
  'https://www.googleapis.com/auth/datastore',
].join(' ')

export type ServiceAccount = {
  clientEmail: string
  privateKey: string
  projectId: string
}

type ServiceAccountJson = {
  client_email?: string
  private_key?: string
  project_id?: string
}

export function parseServiceAccountJson(json: string): ServiceAccount {
  const parsed = JSON.parse(json) as ServiceAccountJson
  const clientEmail = parsed.client_email
  const privateKey = parsed.private_key
  const projectId = parsed.project_id
  if (!clientEmail || !privateKey || !projectId) {
    throw new Error('Invalid service account JSON')
  }
  return { clientEmail, privateKey, projectId }
}

export async function getGoogleAccessToken(
  sa: ServiceAccount,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const privateKey = await jose.importPKCS8(sa.privateKey, 'RS256')
  const assertion = await new jose.SignJWT({ scope: GOOGLE_SCOPES })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.clientEmail)
    .setSubject(sa.clientEmail)
    .setAudience(GOOGLE_TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey)

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  })

  const res = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    throw new Error(`Google token request failed: ${res.status}`)
  }

  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) {
    throw new Error('Google token response missing access_token')
  }
  return data.access_token
}
