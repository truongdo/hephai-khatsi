import * as jose from 'jose'

const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null

function getJwks() {
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(new URL(FIREBASE_JWKS_URL))
  }
  return jwks
}

export async function verifyFirebaseAdminToken(
  idToken: string,
  projectId: string,
): Promise<{ uid: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(idToken, getJwks(), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    })
    if (payload.admin !== true) return null
    if (typeof payload.sub !== 'string') return null
    return { uid: payload.sub }
  } catch {
    return null
  }
}
