import { describe, expect, it } from 'vitest'
import { sniffContentType } from './uploadContent'

describe('sniffContentType', () => {
  it('recognises JPEG, PNG and PDF by their first bytes', () => {
    expect(sniffContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe('image/jpeg')
    expect(sniffContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(
      'image/png',
    )
    expect(sniffContentType(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf')
  })

  it('refuses anything else, whatever its name or claimed type', () => {
    expect(sniffContentType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull()
    expect(sniffContentType(new TextEncoder().encode('<html>'))).toBeNull()
    expect(sniffContentType(new Uint8Array([0xff, 0xd8]))).toBeNull()
    expect(sniffContentType(new Uint8Array())).toBeNull()
  })
})
