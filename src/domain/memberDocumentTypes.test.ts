import { describe, expect, it } from 'vitest'
import {
  MEMBER_DOCUMENT_TYPES,
  extForContentType,
  getDocumentType,
  isValidDocumentSide,
  memberDocumentObjectKey,
  pathFieldForSide,
} from './memberDocumentTypes'

describe('memberDocumentTypes', () => {
  it('registers eight types with expected sides', () => {
    expect(MEMBER_DOCUMENT_TYPES).toHaveLength(8)
    expect(getDocumentType('cccd')?.sides).toBe('frontBack')
    expect(getDocumentType('diep_sa_di')?.sides).toBe('single')
  })

  it('validates sides against registry', () => {
    const cccd = getDocumentType('cccd')!
    expect(isValidDocumentSide(cccd, 'front')).toBe(true)
    expect(isValidDocumentSide(cccd, 'file')).toBe(false)
    const single = getDocumentType('diep_sa_di')!
    expect(isValidDocumentSide(single, 'file')).toBe(true)
    expect(isValidDocumentSide(single, 'front')).toBe(false)
  })

  it('builds R2 keys with content-type extension', () => {
    expect(extForContentType('image/jpeg')).toBe('jpg')
    expect(extForContentType('application/pdf')).toBe('pdf')
    expect(
      memberDocumentObjectKey('m1', 'cccd', 'front', 'image/png'),
    ).toBe('members/m1/docs/cccd/front.png')
    expect(pathFieldForSide('back')).toBe('backPath')
  })
})
