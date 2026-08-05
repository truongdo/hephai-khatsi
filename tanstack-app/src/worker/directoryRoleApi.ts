import { blocksSecretaryGrantOnAuthClaims } from '#/domain/authClaims'
import { isGmailEmail, normalizeEmail } from '#/domain/gmail'
import type { Env } from './env'
import {
  getMemberAdminFields,
  listSecretaries,
  patchMemberDirectoryFields,
} from './firestoreAdminRest'
import {
  createAuthUserWithEmail,
  lookupAuthUserByEmail,
  setAuthCustomClaims,
} from './identityToolkit'
import {
  getGoogleAccessToken,
  parseServiceAccountJson,
} from './googleServiceAccount'
import { verifyHePhaiAdminToken } from './verifyFirebaseAdmin'

type DirectoryRoleBody = {
  memberId?: string
}

function bearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length)
}

function jsonError(
  body: { error?: string; code?: string },
  status: number,
): Response {
  return Response.json(body, { status })
}

async function getServiceAccessToken(env: Env): Promise<string> {
  const sa = parseServiceAccountJson(env.FIREBASE_SERVICE_ACCOUNT_JSON)
  return getGoogleAccessToken(sa)
}

function directoryRoleUpstreamError(err: unknown): Response {
  console.error('[directory-role]', err)
  const message = err instanceof Error ? err.message : ''
  const isUpstream =
    message.includes('Identity Toolkit') || message.includes('Google token')
  return jsonError(
    {
      error:
        isUpstream
          ? 'Identity provider request failed'
          : 'Internal server error',
    },
    isUpstream ? 502 : 500,
  )
}

async function handleGrant(
  request: Request,
  env: Env,
  grantedByUid: string,
): Promise<Response> {
  let body: DirectoryRoleBody
  try {
    body = (await request.json()) as DirectoryRoleBody
  } catch {
    return jsonError({ error: 'Invalid JSON' }, 400)
  }

  const memberId = body.memberId
  if (!memberId || typeof memberId !== 'string') {
    return jsonError({ error: 'memberId required' }, 400)
  }

  try {
    const accessToken = await getServiceAccessToken(env)
    const member = await getMemberAdminFields(
      accessToken,
      env.FIREBASE_PROJECT_ID,
      memberId,
    )
    if (!member) {
      return jsonError({ error: 'Member not found' }, 404)
    }

    if (!isGmailEmail(member.email)) {
      return jsonError({ code: 'EMAIL_NOT_GMAIL' }, 400)
    }

    if (member.directoryRole === 'giao_doan_admin') {
      return jsonError({ code: 'ALREADY_SECRETARY' }, 400)
    }

    const secretaries = await listSecretaries(
      accessToken,
      env.FIREBASE_PROJECT_ID,
    )
    const normalizedEmail = normalizeEmail(member.email)
    const duplicate = secretaries.find(
      (s) => s.id !== memberId && normalizeEmail(s.email) === normalizedEmail,
    )
    if (duplicate) {
      return jsonError({ code: 'EMAIL_IN_USE' }, 400)
    }

    let authUser = await lookupAuthUserByEmail(
      accessToken,
      env.FIREBASE_PROJECT_ID,
      member.email,
    )
    if (!authUser) {
      authUser = await createAuthUserWithEmail(
        accessToken,
        env.FIREBASE_PROJECT_ID,
        member.email,
      )
      authUser = { localId: authUser.localId, customClaims: {} }
    } else if (
      blocksSecretaryGrantOnAuthClaims(authUser.customClaims, member.orgUnitId)
    ) {
      return jsonError({ code: 'AUTH_USER_PRIVILEGED' }, 400)
    }

    const directoryAuthUid = authUser.localId

    await setAuthCustomClaims(
      accessToken,
      env.FIREBASE_PROJECT_ID,
      directoryAuthUid,
      { role: 'giao_doan_admin', orgUnitId: member.orgUnitId },
    )

    try {
      await patchMemberDirectoryFields(
        accessToken,
        env.FIREBASE_PROJECT_ID,
        memberId,
        {
          directoryRole: 'giao_doan_admin',
          directoryAuthUid,
          directoryRoleGrantedAt: new Date().toISOString(),
          directoryRoleGrantedBy: grantedByUid,
        },
      )
    } catch {
      await setAuthCustomClaims(
        accessToken,
        env.FIREBASE_PROJECT_ID,
        directoryAuthUid,
        {},
      )
      return jsonError({ error: 'Failed to update member' }, 500)
    }

    return Response.json({
      memberId,
      directoryAuthUid,
      orgUnitId: member.orgUnitId,
      email: member.email,
    })
  } catch (err) {
    return directoryRoleUpstreamError(err)
  }
}

async function handleRevoke(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: DirectoryRoleBody
  try {
    body = (await request.json()) as DirectoryRoleBody
  } catch {
    return jsonError({ error: 'Invalid JSON' }, 400)
  }

  const memberId = body.memberId
  if (!memberId || typeof memberId !== 'string') {
    return jsonError({ error: 'memberId required' }, 400)
  }

  try {
    const accessToken = await getServiceAccessToken(env)
    const member = await getMemberAdminFields(
      accessToken,
      env.FIREBASE_PROJECT_ID,
      memberId,
    )
    if (!member) {
      return jsonError({ error: 'Member not found' }, 404)
    }

    if (!member.directoryRole) {
      return Response.json({ memberId })
    }

    if (member.directoryAuthUid) {
      await setAuthCustomClaims(
        accessToken,
        env.FIREBASE_PROJECT_ID,
        member.directoryAuthUid,
        {},
      )
    }

    await patchMemberDirectoryFields(
      accessToken,
      env.FIREBASE_PROJECT_ID,
      memberId,
      {
        directoryRole: null,
        directoryAuthUid: null,
        directoryRoleGrantedAt: null,
        directoryRoleGrantedBy: null,
      },
    )

    return Response.json({ memberId })
  } catch (err) {
    return directoryRoleUpstreamError(err)
  }
}

export async function handleDirectoryRoleApi(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url)
  const token = bearerToken(request)
  if (!token) {
    return jsonError({ error: 'Unauthorized' }, 401)
  }

  const admin = await verifyHePhaiAdminToken(token, env.FIREBASE_PROJECT_ID)
  if (!admin) {
    return jsonError({ error: 'Forbidden' }, 403)
  }

  if (request.method !== 'POST') {
    return jsonError({ error: 'Method not allowed' }, 405)
  }

  if (url.pathname === '/api/admin/directory-role/grant') {
    return handleGrant(request, env, admin.uid)
  }

  if (url.pathname === '/api/admin/directory-role/revoke') {
    return handleRevoke(request, env)
  }

  return jsonError({ error: 'Not found' }, 404)
}
