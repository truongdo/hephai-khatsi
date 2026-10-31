import { canAccessOrgUnit } from '#/domain/authClaims'
import { normalizeCccd } from '#/domain/normalize'
import type { Env } from './env'
import { fillerInviteOk } from './fillerMediaAuth'
import { recordSource } from './recordSource'
import { createR2PresignedPutUrl, memberPhotoKey, templePhotoKey } from './presignR2Put'
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
  cccd?: string
  inviteToken?: string
}

type TempleUploadUrlBody = {
  templeId?: string
  contentType?: string
  inviteToken?: string
}

type TempleDeleteBody = {
  templeId?: string
  inviteToken?: string
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

  const member = await recordSource(env).getMember(memberId)
  if (!member) return jsonError('Member not found', 404)
  if (!cccdMatches(member.cccd, cccd)) return jsonError('CCCD mismatch', 403)

  const token = bearerToken(request)
  let isAdmin = false
  if (token) {
    const admin = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
    if (!admin) return jsonError('Unauthorized', 401)
    if (!canAccessOrgUnit(admin, member.orgUnitId)) return jsonError('Forbidden', 403)
    isAdmin = true
  } else if (inviteToken) {
    if (!(await fillerInviteOk(env, member.inviteId, inviteToken))) return jsonError('Forbidden', 403)
  } else {
    return jsonError('Unauthorized', 401)
  }

  // Filler may attach a first photo after save-and-lock, but not replace.
  if (!isAdmin && member.status === 'locked' && member.photoPath) {
    return jsonError('Photo already set', 403)
  }

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
  let body: MemberDeleteBody
  try {
    body = (await request.json()) as MemberDeleteBody
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const { memberId, cccd, inviteToken } = body
  if (!memberId) return jsonError('Missing memberId', 400)

  const member = await recordSource(env).getMember(memberId)
  const token = bearerToken(request)
  if (!member) {
    // Deleting members removes the D1 row first: staff then clear the photo it left.
    if (token && (await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID))) {
      await env.PHOTOS.delete(memberPhotoKey(memberId))
      return Response.json({ ok: true })
    }
    return jsonError('Member not found', 404)
  }

  let isAdmin = false
  if (token) {
    const admin = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
    if (!admin) return jsonError('Unauthorized', 401)
    if (!canAccessOrgUnit(admin, member.orgUnitId)) return jsonError('Forbidden', 403)
    isAdmin = true
  } else if (inviteToken) {
    if (!cccd) return jsonError('Missing required fields', 400)
    if (!cccdMatches(member.cccd, cccd)) return jsonError('CCCD mismatch', 403)
    if (!(await fillerInviteOk(env, member.inviteId, inviteToken))) return jsonError('Forbidden', 403)
  } else {
    return jsonError('Unauthorized', 401)
  }

  if (member.status === 'locked' && !isAdmin) {
    return jsonError('Member is locked', 403)
  }

  await env.PHOTOS.delete(memberPhotoKey(memberId))
  return Response.json({ ok: true })
}

async function handleTempleUploadUrl(request: Request, env: Env): Promise<Response> {
  let body: TempleUploadUrlBody
  try {
    body = (await request.json()) as TempleUploadUrlBody
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const { templeId, contentType, inviteToken } = body
  if (!templeId || !contentType) {
    return jsonError('Missing required fields', 400)
  }
  if (!IMAGE_CONTENT_TYPE.test(contentType)) {
    return jsonError('Invalid content type', 400)
  }

  const temple = await recordSource(env).getTemple(templeId)
  if (!temple) return jsonError('Temple not found', 404)

  const token = bearerToken(request)
  let isAdmin = false
  if (token) {
    const admin = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
    if (!admin) return jsonError('Unauthorized', 401)
    if (!canAccessOrgUnit(admin, temple.orgUnitId)) return jsonError('Forbidden', 403)
    isAdmin = true
  } else if (inviteToken) {
    if (!(await fillerInviteOk(env, temple.inviteId, inviteToken))) return jsonError('Forbidden', 403)
  } else {
    return jsonError('Unauthorized', 401)
  }

  // Filler may attach a first photo after save-and-lock, but not replace.
  if (!isAdmin && temple.status === 'locked' && temple.photoPath) {
    return jsonError('Photo already set', 403)
  }

  const photoPath = templePhotoKey(templeId)
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

async function handleTempleDelete(request: Request, env: Env): Promise<Response> {
  let body: TempleDeleteBody
  try {
    body = (await request.json()) as TempleDeleteBody
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const { templeId, inviteToken } = body
  if (!templeId) return jsonError('Missing templeId', 400)

  const temple = await recordSource(env).getTemple(templeId)
  const token = bearerToken(request)
  if (!temple) {
    // Deleting temples removes the D1 row first: staff then clear the photo it left.
    if (token && (await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID))) {
      await env.PHOTOS.delete(templePhotoKey(templeId))
      return Response.json({ ok: true })
    }
    return jsonError('Temple not found', 404)
  }

  let isAdmin = false
  if (token) {
    const admin = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
    if (!admin) return jsonError('Unauthorized', 401)
    if (!canAccessOrgUnit(admin, temple.orgUnitId)) return jsonError('Forbidden', 403)
    isAdmin = true
  } else if (inviteToken) {
    if (!(await fillerInviteOk(env, temple.inviteId, inviteToken))) return jsonError('Forbidden', 403)
  } else {
    return jsonError('Unauthorized', 401)
  }

  if (temple.status === 'locked' && !isAdmin) {
    return jsonError('Temple is locked', 403)
  }

  await env.PHOTOS.delete(templePhotoKey(templeId))
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

  if (pathname === '/api/photos/temple-upload-url' && request.method === 'POST') {
    return handleTempleUploadUrl(request, env)
  }

  if (pathname === '/api/photos/temple' && request.method === 'DELETE') {
    return handleTempleDelete(request, env)
  }

  return new Response('Not found', { status: 404 })
}
