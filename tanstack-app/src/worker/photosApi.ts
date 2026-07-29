import { normalizeCccd } from '#/domain/normalize'
import type { Env } from './env'
import {
  getMemberDocument,
  getTempleDocument,
  inviteExists,
} from './firestoreRest'
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

  const member = await getMemberDocument(env.FIREBASE_PROJECT_ID, memberId)
  if (!member) return jsonError('Member not found', 404)
  if (!cccdMatches(member.cccd, cccd)) return jsonError('CCCD mismatch', 403)

  let isAdmin = false
  const token = bearerToken(request)
  if (token) {
    const admin = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
    if (!admin) return jsonError('Unauthorized', 401)
    isAdmin = true
  } else if (inviteToken) {
    // Global invite has no orgUnitId — existence only (same as temple photo auth).
    const exists = await inviteExists(env.FIREBASE_PROJECT_ID, inviteToken)
    if (!exists) return jsonError('Forbidden', 403)
  } else {
    return jsonError('Unauthorized', 401)
  }

  if (member.status === 'locked' && !isAdmin) {
    return jsonError('Member is locked', 403)
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

  const member = await getMemberDocument(env.FIREBASE_PROJECT_ID, memberId)
  if (!member) return jsonError('Member not found', 404)

  let isAdmin = false
  const token = bearerToken(request)
  if (token) {
    const admin = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
    if (!admin) return jsonError('Unauthorized', 401)
    isAdmin = true
  } else if (inviteToken) {
    if (!cccd) return jsonError('Missing required fields', 400)
    if (!cccdMatches(member.cccd, cccd)) return jsonError('CCCD mismatch', 403)
    const exists = await inviteExists(env.FIREBASE_PROJECT_ID, inviteToken)
    if (!exists) return jsonError('Forbidden', 403)
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

  const temple = await getTempleDocument(env.FIREBASE_PROJECT_ID, templeId)
  if (!temple) return jsonError('Temple not found', 404)

  let isAdmin = false
  const token = bearerToken(request)
  if (token) {
    const admin = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
    if (!admin) return jsonError('Unauthorized', 401)
    isAdmin = true
  } else if (inviteToken) {
    const exists = await inviteExists(env.FIREBASE_PROJECT_ID, inviteToken)
    if (!exists) return jsonError('Forbidden', 403)
  } else {
    return jsonError('Unauthorized', 401)
  }

  if (temple.status === 'locked' && !isAdmin) {
    return jsonError('Temple is locked', 403)
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

  const temple = await getTempleDocument(env.FIREBASE_PROJECT_ID, templeId)
  if (!temple) return jsonError('Temple not found', 404)

  let isAdmin = false
  const token = bearerToken(request)
  if (token) {
    const admin = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
    if (!admin) return jsonError('Unauthorized', 401)
    isAdmin = true
  } else if (inviteToken) {
    const exists = await inviteExists(env.FIREBASE_PROJECT_ID, inviteToken)
    if (!exists) return jsonError('Forbidden', 403)
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
