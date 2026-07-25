import { normalizeCccd } from '#/domain/normalize'
import type { Env } from './env'
import { getInviteOrgUnitId, getMemberDocument } from './firestoreRest'
import { createR2PresignedPutUrl, memberPhotoKey } from './presignR2Put'
import { verifyFirebaseAdminToken } from './verifyFirebaseAdmin'

const PRESIGN_TTL_SECONDS = 300
const IMAGE_CONTENT_TYPE = /^image\//

type MemberUploadUrlBody = {
  memberId?: string
  cccd?: string
  contentType?: string
  inviteToken?: string
}

type MemberDeleteBody = {
  memberId?: string
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

function cccdMatches(memberCccd: string, providedCccd: string): boolean {
  try {
    return normalizeCccd(providedCccd) === normalizeCccd(memberCccd)
  } catch {
    return false
  }
}

function bearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length)
}

async function requireAdmin(request: Request, env: Env): Promise<Response | null> {
  const token = bearerToken(request)
  if (!token) return jsonError('Unauthorized', 401)

  const admin = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
  if (!admin) return jsonError('Unauthorized', 401)

  return null
}

async function authorizeMemberUpload(
  request: Request,
  env: Env,
  memberOrgUnitId: string,
  inviteToken?: string,
): Promise<Response | null> {
  const token = bearerToken(request)
  if (token) {
    const admin = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
    if (!admin) return jsonError('Unauthorized', 401)
    return null
  }

  if (!inviteToken) return jsonError('Unauthorized', 401)

  const orgUnitId = await getInviteOrgUnitId(env.FIREBASE_PROJECT_ID, inviteToken)
  if (!orgUnitId || orgUnitId !== memberOrgUnitId) {
    return jsonError('Forbidden', 403)
  }

  return null
}

async function handleMemberUploadUrl(request: Request, env: Env): Promise<Response> {
  let body: MemberUploadUrlBody
  try {
    body = (await request.json()) as MemberUploadUrlBody
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const { memberId, cccd, contentType, inviteToken } = body
  if (!memberId || !cccd || !contentType) {
    return jsonError('Missing required fields', 400)
  }
  if (!IMAGE_CONTENT_TYPE.test(contentType)) {
    return jsonError('Invalid content type', 400)
  }

  const member = await getMemberDocument(env.FIREBASE_PROJECT_ID, memberId)
  if (!member) return jsonError('Member not found', 404)
  if (member.status === 'locked') return jsonError('Member is locked', 403)
  if (!cccdMatches(member.cccd, cccd)) return jsonError('CCCD mismatch', 403)

  const authError = await authorizeMemberUpload(
    request,
    env,
    member.orgUnitId,
    inviteToken,
  )
  if (authError) return authError

  const photoPath = memberPhotoKey(memberId)
  const uploadUrl = await createR2PresignedPutUrl({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET_NAME,
    key: photoPath,
    contentType,
    expiresSeconds: PRESIGN_TTL_SECONDS,
  })

  return Response.json({ uploadUrl, photoPath })
}

async function handleMemberDelete(request: Request, env: Env): Promise<Response> {
  const authError = await requireAdmin(request, env)
  if (authError) return authError

  let body: MemberDeleteBody
  try {
    body = (await request.json()) as MemberDeleteBody
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const { memberId } = body
  if (!memberId) return jsonError('Missing memberId', 400)

  await env.PHOTOS.delete(memberPhotoKey(memberId))
  return Response.json({ ok: true })
}

export async function handlePhotosApi(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url)

  if (pathname === '/api/photos/member-upload-url' && request.method === 'POST') {
    return handleMemberUploadUrl(request, env)
  }

  if (pathname === '/api/photos/member' && request.method === 'DELETE') {
    return handleMemberDelete(request, env)
  }

  return new Response('Not found', { status: 404 })
}
