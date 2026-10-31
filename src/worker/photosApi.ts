import { canAccessOrgUnit } from '#/domain/authClaims'
import { memberPhotoKey, templePhotoKey } from '#/domain/recordFiles'
import { PHOTO_CONTENT_TYPES, PHOTO_MAX_BYTES } from '#/domain/uploadContent'
import type { Env } from './env'
import { fillerInviteOk } from './fillerMediaAuth'
import { recordSource, type WorkerMember, type WorkerTemple } from './recordSource'
import { bearerToken, cccdMatches, jsonError, readUpload, type Upload } from './uploadRequest'
import { verifyFirebaseAdminToken } from './verifyFirebaseAdmin'

// Portrait uploads (multipart: the record's fields and `file`). The Worker
// writes the object; the client then records the path through the data API
// (`members/set-photo`, `temples/set-photo`), which also deletes photos a
// record drops.

/**
 * Who may write the record's photo: staff of its org unit, or a filler of a
 * record that names an existing invite (on a locked record only the first
 * portrait, never a replacement).
 */
async function authorizePhotoWrite(
  request: Request,
  env: Env,
  record: WorkerMember | WorkerTemple,
  upload: Upload,
): Promise<Response | null> {
  const token = bearerToken(request)
  if (token) {
    const admin = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
    if (!admin) return jsonError('Unauthorized', 401)
    return canAccessOrgUnit(admin, record.orgUnitId) ? null : jsonError('Forbidden', 403)
  }
  const inviteToken = upload.field('inviteToken')
  if (!inviteToken) return jsonError('Unauthorized', 401)
  if (!(await fillerInviteOk(env, record.inviteId, inviteToken))) return jsonError('Forbidden', 403)
  if (record.status === 'locked' && record.photoPath) return jsonError('Photo already set', 403)
  return null
}

async function putPhoto(env: Env, key: string, upload: Upload): Promise<void> {
  await env.PHOTOS.put(key, upload.bytes, { httpMetadata: { contentType: upload.contentType } })
}

async function handleMemberUpload(request: Request, env: Env): Promise<Response> {
  const upload = await readUpload(request, { maxBytes: PHOTO_MAX_BYTES, contentTypes: PHOTO_CONTENT_TYPES })
  if (upload instanceof Response) return upload
  const memberId = upload.field('memberId')
  if (!memberId) return jsonError('Missing required fields', 400)

  const member = await recordSource(env).getMember(memberId)
  if (!member) return jsonError('Member not found', 404)
  if (!cccdMatches(member.cccd, upload.field('cccd'))) return jsonError('CCCD mismatch', 403)
  const denied = await authorizePhotoWrite(request, env, member, upload)
  if (denied) return denied

  const photoPath = memberPhotoKey(memberId)
  await putPhoto(env, photoPath, upload)
  return Response.json({ photoPath })
}

async function handleTempleUpload(request: Request, env: Env): Promise<Response> {
  const upload = await readUpload(request, { maxBytes: PHOTO_MAX_BYTES, contentTypes: PHOTO_CONTENT_TYPES })
  if (upload instanceof Response) return upload
  const templeId = upload.field('templeId')
  if (!templeId) return jsonError('Missing required fields', 400)

  const temple = await recordSource(env).getTemple(templeId)
  if (!temple) return jsonError('Temple not found', 404)
  const denied = await authorizePhotoWrite(request, env, temple, upload)
  if (denied) return denied

  const photoPath = templePhotoKey(templeId)
  await putPhoto(env, photoPath, upload)
  return Response.json({ photoPath })
}

export async function handlePhotosApi(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url)

  if (pathname === '/api/photos/member' && request.method === 'POST') {
    return handleMemberUpload(request, env)
  }

  if (pathname === '/api/photos/temple' && request.method === 'POST') {
    return handleTempleUpload(request, env)
  }

  return new Response('Not found', { status: 404 })
}
