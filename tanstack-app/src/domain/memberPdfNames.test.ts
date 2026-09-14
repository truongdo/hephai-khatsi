import { describe, expect, it } from 'vitest'
import {
  extFromObjectKeyOrType,
  memberPdfFilename,
  memberPdfSlug,
  memberPdfZipDocEntry,
  memberPdfZipFolder,
  membersMergedPdfFilename,
  membersPdfZipFilename,
} from '#/domain/memberPdfNames'

describe('memberPdfSlug', () => {
  it('prefers phapDanh, then theDanh, then member', () => {
    expect(memberPdfSlug({ phapDanh: 'Minh Tâm', theDanh: 'Nguyễn A' })).toBe('Minh_Tam')
    expect(memberPdfSlug({ theDanh: 'Nguyễn Văn A' })).toBe('Nguyen_Van_A')
    expect(memberPdfSlug({})).toBe('member')
  })

  it('strips path-unsafe characters', () => {
    expect(memberPdfSlug({ phapDanh: 'A/B\\C:D*E?' })).toBe('A_B_C_D_E')
  })
})

describe('filenames', () => {
  it('builds per-member and batch names', () => {
    expect(
      memberPdfFilename({ id: 'm1', phapDanh: 'Minh Tam' }),
    ).toBe('HoSo_Minh_Tam_m1.pdf')
    const d = new Date(2026, 8, 14) // local Sep 14
    expect(membersMergedPdfFilename(d)).toBe('HoSoMembers_2026-09-14.pdf')
    expect(membersPdfZipFilename(d)).toBe('HoSoMembers_2026-09-14.zip')
  })

  it('builds zip document entry paths', () => {
    const folder = memberPdfZipFolder({ id: 'm1', phapDanh: 'Minh Tam' })
    expect(folder).toBe('Minh_Tam_m1')
    expect(memberPdfZipDocEntry(folder, 'cccd', 'front', 'jpg')).toBe(
      'Minh_Tam_m1/documents/cccd_front.jpg',
    )
  })

  it('picks extension from key or content-type', () => {
    expect(extFromObjectKeyOrType('members/m1/docs/cccd/front.jpg')).toBe('jpg')
    expect(extFromObjectKeyOrType('x', 'application/pdf')).toBe('pdf')
    expect(extFromObjectKeyOrType('x', 'image/png')).toBe('png')
  })
})
