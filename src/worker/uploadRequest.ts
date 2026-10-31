import { normalizeCccd } from '#/domain/normalize'
import { sniffContentType, type UploadContentType } from '#/domain/uploadContent'

// Shared by the photo and document upload routes: a multipart form with the
// record's fields and one `file`, checked here (size, content by signature)
// before anything is written to R2.

/** Room for the form fields and multipart boundaries around the file. */
const FORM_OVERHEAD_BYTES = 64 * 1024

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

export function bearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length)
}

export function cccdMatches(memberCccd: string, providedCccd: string | undefined): boolean {
  if (!providedCccd) return false
  try {
    return normalizeCccd(providedCccd) === normalizeCccd(memberCccd)
  } catch {
    return false
  }
}

export type Upload = {
  field(name: string): string | undefined
  bytes: Uint8Array
  contentType: UploadContentType
}

/** The upload, or the error response to send. */
export async function readUpload(
  request: Request,
  limits: { maxBytes: number; contentTypes: readonly UploadContentType[] },
): Promise<Upload | Response> {
  const declaredLength = Number(request.headers.get('Content-Length') ?? 0)
  if (declaredLength > limits.maxBytes + FORM_OVERHEAD_BYTES) return jsonError('File too large', 413)
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return jsonError('Invalid form data', 400)
  }
  const file = form.get('file')
  if (file === null || typeof file === 'string') return jsonError('Missing file', 400)
  if (file.size > limits.maxBytes) return jsonError('File too large', 413)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const contentType = sniffContentType(bytes)
  if (!contentType || !limits.contentTypes.includes(contentType)) {
    return jsonError('Invalid content type', 400)
  }
  return {
    field: (name) => {
      const value = form.get(name)
      return typeof value === 'string' && value.length > 0 ? value : undefined
    },
    bytes,
    contentType,
  }
}
