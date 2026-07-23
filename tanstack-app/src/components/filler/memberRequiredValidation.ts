import type { AddressDraft } from '#/domain/address'
import { validateAddressDraft } from '#/domain/address'

export type MemberRequiredDraft = {
  theDanh: string
  phapDanh: string
  ngaySinh: string
  noiSinh: AddressDraft
  dienThoai: string
  email: string
  diaChiThuongTru: AddressDraft
  ngayXuatGia: string
  noiXuatGia: AddressDraft
  hienTuHoc: string
  bonSu: string
}

export type MemberRequiredFieldErrors = {
  theDanh?: 'REQUIRED'
  phapDanh?: 'REQUIRED'
  ngaySinh?: 'REQUIRED'
  noiSinh?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  dienThoai?: 'REQUIRED'
  email?: 'REQUIRED' | 'INVALID'
  diaChiThuongTru?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  ngayXuatGia?: 'REQUIRED'
  noiXuatGia?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  hienTuHoc?: 'REQUIRED'
  bonSu?: 'REQUIRED'
}

const BASIC_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isBasicEmail(value: string): boolean {
  return BASIC_EMAIL.test(value.trim())
}

function requireText(value: string): 'REQUIRED' | undefined {
  return value.trim() ? undefined : 'REQUIRED'
}

function mapAddress(
  draft: AddressDraft,
): { city?: 'REQUIRED'; ward?: 'REQUIRED' } | undefined {
  const result = validateAddressDraft(draft, { required: true })
  if (result.valid) return undefined
  return result.errors
}

export function validateMemberRequiredFields(draft: MemberRequiredDraft): {
  valid: boolean
  errors: MemberRequiredFieldErrors
} {
  const errors: MemberRequiredFieldErrors = {}

  const theDanh = requireText(draft.theDanh)
  if (theDanh) errors.theDanh = theDanh
  const phapDanh = requireText(draft.phapDanh)
  if (phapDanh) errors.phapDanh = phapDanh
  const ngaySinh = requireText(draft.ngaySinh)
  if (ngaySinh) errors.ngaySinh = ngaySinh
  const dienThoai = requireText(draft.dienThoai)
  if (dienThoai) errors.dienThoai = dienThoai
  const ngayXuatGia = requireText(draft.ngayXuatGia)
  if (ngayXuatGia) errors.ngayXuatGia = ngayXuatGia
  const hienTuHoc = requireText(draft.hienTuHoc)
  if (hienTuHoc) errors.hienTuHoc = hienTuHoc
  const bonSu = requireText(draft.bonSu)
  if (bonSu) errors.bonSu = bonSu

  const emailTrimmed = draft.email.trim()
  if (!emailTrimmed) errors.email = 'REQUIRED'
  else if (!isBasicEmail(emailTrimmed)) errors.email = 'INVALID'

  const noiSinh = mapAddress(draft.noiSinh)
  if (noiSinh) errors.noiSinh = noiSinh
  const diaChiThuongTru = mapAddress(draft.diaChiThuongTru)
  if (diaChiThuongTru) errors.diaChiThuongTru = diaChiThuongTru
  const noiXuatGia = mapAddress(draft.noiXuatGia)
  if (noiXuatGia) errors.noiXuatGia = noiXuatGia

  return { valid: Object.keys(errors).length === 0, errors }
}
