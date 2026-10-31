// What the Worker accepts as an uploaded portrait or member document. The
// type comes from the file's first bytes, never from what the client claims.

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024

export type UploadContentType = 'image/jpeg' | 'image/png' | 'application/pdf'

export const PHOTO_CONTENT_TYPES: readonly UploadContentType[] = ['image/jpeg', 'image/png']

const SIGNATURES: ReadonlyArray<{ type: UploadContentType; bytes: readonly number[] }> = [
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
]

/** The content type of a JPEG, PNG or PDF file, from its signature; null for anything else. */
export function sniffContentType(bytes: Uint8Array): UploadContentType | null {
  const match = SIGNATURES.find(({ bytes: signature }) =>
    signature.every((byte, i) => bytes[i] === byte),
  )
  return match?.type ?? null
}
