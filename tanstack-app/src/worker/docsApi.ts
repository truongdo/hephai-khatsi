import {
  extForContentType,
  getDocumentType,
  isValidDocumentSide,
  MEMBER_DOCUMENT_CONTENT_TYPES,
} from '#/domain/memberDocumentTypes'
import { normalizeCccd } from '#/domain/normalize'
import type { Env } from './env'
import { getMemberDocument, inviteExists } from './firestoreRest'
import { createR2PresignedPutUrl, memberDocumentKey } from './presignR2Put'
import { verifyFirebaseAdminToken } from './verifyFirebaseAdmin'

const PRESIGN_TTL_SECONDS = 300

const ALLOWED_CONTENT_TYPES = new Set<string>(MEMBER_DOCUMENT_CONTENT_TYPES)

type MemberUploadUrlBody = {
  memberId?: string
  cccd?: string
  typeId?: string
  side?: string
  contentType?: string
  inviteToken?: string
}

type MemberDeleteBody = {
  memberId?: string
  typeId?: string
  side?: string
  paths?: string[]
  cccd?: string
  inviteToken?: string
}

type MemberPrefixDeleteBody = {
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

function memberDocsPrefix(memberId: string): string {
  return `members/${memberId}/docs/`
}

function isPathUnderMemberDocs(memberId: string, path: string): boolean {
  return path.startsWith(memberDocsPrefix(memberId))
}

async function handleMemberUploadUrl(request: Request, env: Env): Promise<Response> {
  let body: MemberUploadUrlBody
  try {
    body = (await request.json()) as MemberUploadUrlBody
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const { memberId, cccd, typeId, side, contentType, inviteToken } = body
  if (!memberId || !cccd || !typeId || !side || !contentType) {
    return jsonError('Missing required fields', 400)
  }
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return jsonError('Invalid content type', 400)
  }

  const docType = getDocumentType(typeId)
  if (!docType) return jsonError('Invalid document type', 400)
  if (!isValidDocumentSide(docType, side)) {
    return jsonError('Invalid side for document type', 400)
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

  const ext = extForContentType(contentType)
  const filePath = memberDocumentKey(memberId, typeId, side, ext)
  const uploadUrl = await createR2PresignedPutUrl({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET_NAME,
    key: filePath,
    contentType,
    expiresSeconds: PRESIGN_TTL_SECONDS,
  })

  return Response.json({ uploadUrl, filePath })
}

async function handleMemberDelete(request: Request, env: Env): Promise<Response> {
  let body: MemberDeleteBody
  try {
    body = (await request.json()) as MemberDeleteBody
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const { memberId, typeId, paths, cccd, inviteToken } = body
  if (!memberId || !typeId || !paths?.length) {
    return jsonError('Missing required fields', 400)
  }

  const docType = getDocumentType(typeId)
  if (!docType) return jsonError('Invalid document type', 400)

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

  for (const path of paths) {
    if (!isPathUnderMemberDocs(memberId, path)) {
      return jsonError('Invalid path', 400)
    }
  }

  await Promise.all(paths.map((path) => env.PHOTOS.delete(path)))
  return Response.json({ ok: true })
}

async function deleteAllUnderPrefix(env: Env, prefix: string): Promise<void> {
  let cursor: string | undefined
  do {
    const listed = await env.PHOTOS.list({ prefix, cursor })
    await Promise.all(listed.objects.map((o) => env.PHOTOS.delete(o.key)))
    if (!listed.truncated) break
    cursor = listed.objects.at(-1)?.key
  } while (cursor)
}

async function handleMemberPrefixDelete(request: Request, env: Env): Promise<Response> {
  let body: MemberPrefixDeleteBody
  try {
    body = (await request.json()) as MemberPrefixDeleteBody
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const { memberId } = body
  if (!memberId) return jsonError('Missing memberId', 400)

  const token = bearerToken(request)
  if (!token) return jsonError('Unauthorized', 401)
  const admin = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
  if (!admin) return jsonError('Unauthorized', 401)

  await deleteAllUnderPrefix(env, memberDocsPrefix(memberId))
  return Response.json({ ok: true })
}

export async function handleDocsApi(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url)

  if (pathname === '/api/docs/member-upload-url' && request.method === 'POST') {
    return handleMemberUploadUrl(request, env)
  }

  if (pathname === '/api/docs/member' && request.method === 'DELETE') {
    return handleMemberDelete(request, env)
  }

  if (pathname === '/api/docs/member-prefix' && request.method === 'DELETE') {
    return handleMemberPrefixDelete(request, env)
  }

  return new Response('Not found', { status: 404 })
}
