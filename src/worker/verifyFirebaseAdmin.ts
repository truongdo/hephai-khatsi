import * as jose from 'jose'

const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

export type AdminRole = 'he_phai_admin' | 'he_phai_secretary' | 'giao_doan_admin'

let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null

function getJwks() {
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(new URL(FIREBASE_JWKS_URL))
  }
  return jwks
}

function resolveAdminRole(payload: jose.JWTPayload): AdminRole | null {
  if (payload.admin === true) {
    return 'he_phai_admin'
  }
  if (
    payload.role === 'he_phai_admin' ||
    payload.role === 'he_phai_secretary' ||
    payload.role === 'giao_doan_admin'
  ) {
    return payload.role
  }
  return null
}

async function verifyAdminPayload(
  idToken: string,
  projectId: string,
): Promise<jose.JWTPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(idToken, getJwks(), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    })
    if (typeof payload.sub !== 'string') return null
    return payload
  } catch {
    return null
  }
}

export async function verifyFirebaseAdminToken(
  idToken: string,
  projectId: string,
): Promise<{ uid: string; role: AdminRole; orgUnitId: string | null } | null> {
  const payload = await verifyAdminPayload(idToken, projectId)
  if (!payload) return null

  const role = resolveAdminRole(payload)
  if (!role) return null

  return {
    uid: payload.sub as string,
    role,
    orgUnitId:
      typeof payload.orgUnitId === 'string' && payload.orgUnitId.length > 0
        ? payload.orgUnitId
        : null,
  }
}

export async function verifyHePhaiAdminToken(
  idToken: string,
  projectId: string,
): Promise<{ uid: string } | null> {
  const result = await verifyFirebaseAdminToken(idToken, projectId)
  if (!result || result.role !== 'he_phai_admin') return null
  return { uid: result.uid }
}
