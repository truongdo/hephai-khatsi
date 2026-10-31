import { canAccessOrgUnit } from '#/domain/authClaims'
import {
  MEMBER_DOCUMENT_MAX_BYTES,
  getDocumentType,
  isValidDocumentSide,
  memberDocumentObjectKey,
} from '#/domain/memberDocumentTypes'
import type { UploadContentType } from '#/domain/uploadContent'
import type { Env } from './env'
import { fillerInviteOk } from './fillerMediaAuth'
import { recordSource } from './recordSource'
import { bearerToken, cccdMatches, jsonError, readUpload } from './uploadRequest'
import { verifyFirebaseAdminToken } from './verifyFirebaseAdmin'

// Member document uploads (multipart: the member's fields, `typeId`, `side`
// and `file`). The client then records the path with
// `members/merge-document`, which also deletes the file it replaces.

const DOCUMENT_CONTENT_TYPES: readonly UploadContentType[] = ['image/jpeg', 'image/png', 'application/pdf']

async function handleMemberUpload(request: Request, env: Env): Promise<Response> {
  const upload = await readUpload(request, {
    maxBytes: MEMBER_DOCUMENT_MAX_BYTES,
    contentTypes: DOCUMENT_CONTENT_TYPES,
  })
  if (upload instanceof Response) return upload
  const memberId = upload.field('memberId')
  const typeId = upload.field('typeId')
  const side = upload.field('side')
  if (!memberId || !typeId || !side) return jsonError('Missing required fields', 400)

  const docType = getDocumentType(typeId)
  if (!docType) return jsonError('Invalid document type', 400)
  if (!isValidDocumentSide(docType, side)) {
    return jsonError('Invalid side for document type', 400)
  }

  const member = await recordSource(env).getMember(memberId)
  if (!member) return jsonError('Member not found', 404)
  if (!cccdMatches(member.cccd, upload.field('cccd'))) return jsonError('CCCD mismatch', 403)

  const token = bearerToken(request)
  const inviteToken = upload.field('inviteToken')
  if (token) {
    const admin = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
    if (!admin) return jsonError('Unauthorized', 401)
    if (!canAccessOrgUnit(admin, member.orgUnitId)) return jsonError('Forbidden', 403)
  } else if (inviteToken) {
    // A filler may add or replace documents also after save-and-lock.
    if (!(await fillerInviteOk(env, member.inviteId, inviteToken))) return jsonError('Forbidden', 403)
  } else {
    return jsonError('Unauthorized', 401)
  }

  const filePath = memberDocumentObjectKey(memberId, docType.id, side, upload.contentType)
  await env.PHOTOS.put(filePath, upload.bytes, { httpMetadata: { contentType: upload.contentType } })
  return Response.json({ filePath })
}

export async function handleDocsApi(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url)

  if (pathname === '/api/docs/member' && request.method === 'POST') {
    return handleMemberUpload(request, env)
  }

  return new Response('Not found', { status: 404 })
}
