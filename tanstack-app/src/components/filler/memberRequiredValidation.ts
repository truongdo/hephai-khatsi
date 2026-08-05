import type { AddressDraft } from '#/domain/address'
import { validateAddressDraft } from '#/domain/address'
import type { MemberDocuments } from '#/domain/memberDocumentTypes'
import type { PendingDocumentFiles } from './MemberDocumentsField'
import type { FamilyPersonDraft } from './memberDraft'

export type MemberRequiredDraft = {
  cccd: string
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
  photoPath: string | null
  pendingPhoto: File | null
  giaDinh: { cha: FamilyPersonDraft; me: FamilyPersonDraft }
  documents: MemberDocuments
  pendingDocuments: PendingDocumentFiles
}

export type MemberRequiredFieldErrors = {
  cccd?: 'REQUIRED' | 'INVALID'
  theDanh?: 'REQUIRED'
  phapDanh?: 'REQUIRED'
  ngaySinh?: 'REQUIRED'
  noiSinh?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  dienThoai?: 'REQUIRED'
  email?: 'REQUIRED' | 'INVALID'
  diaChiThuongTru?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  ngayXuatGia?: 'REQUIRED'
  noiXuatGia?: { city?: 'REQUIRED'; ward?: 'REQUIRED'; line?: 'REQUIRED' }
  hienTuHoc?: 'REQUIRED'
  bonSu?: 'REQUIRED'
  photo?: 'REQUIRED'
  cccdDocument?: 'REQUIRED'
  giaDinh?: {
    cha?: Partial<Record<keyof FamilyPersonDraft, 'REQUIRED'>>
    me?: Partial<Record<keyof FamilyPersonDraft, 'REQUIRED'>>
  }
}

const BASIC_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isBasicEmail(value: string): boolean {
  return BASIC_EMAIL.test(value.trim())
}

function requireText(value: string): 'REQUIRED' | undefined {
  return value.trim() ? undefined : 'REQUIRED'
}

/** Mirror `normalizeCccd` without throwing — empty → REQUIRED, bad length → INVALID. */
function requireCccd(raw: string): 'REQUIRED' | 'INVALID' | undefined {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return 'REQUIRED'
  if (digits.length < 9 || digits.length > 12) return 'INVALID'
  return undefined
}

function requireFamilyPerson(
  person: FamilyPersonDraft,
): Partial<Record<keyof FamilyPersonDraft, 'REQUIRED'>> | undefined {
  const errors: Partial<Record<keyof FamilyPersonDraft, 'REQUIRED'>> = {}
  for (const key of ['hoTen', 'namSinh', 'ngheNghiep', 'noiO'] as const) {
    if (!person[key].trim()) errors[key] = 'REQUIRED'
  }
  return Object.keys(errors).length ? errors : undefined
}

function mapAddress(
  draft: AddressDraft,
  options?: { cityOnly?: boolean; lineRequired?: boolean },
): { city?: 'REQUIRED'; ward?: 'REQUIRED'; line?: 'REQUIRED' } | undefined {
  const result = validateAddressDraft(draft, {
    required: true,
    cityOnly: options?.cityOnly,
    lineRequired: options?.lineRequired,
  })
  if (result.valid) return undefined
  return result.errors
}

export function validateMemberRequiredFields(draft: MemberRequiredDraft): {
  valid: boolean
  errors: MemberRequiredFieldErrors
} {
  const errors: MemberRequiredFieldErrors = {}

  const cccd = requireCccd(draft.cccd)
  if (cccd) errors.cccd = cccd

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

  if (!draft.photoPath && !draft.pendingPhoto) errors.photo = 'REQUIRED'

  const cccdFiles = draft.documents.cccd
  const cccdPending = draft.pendingDocuments.cccd
  const hasCccdFront = Boolean(cccdFiles?.frontPath || cccdPending?.front)
  const hasCccdBack = Boolean(cccdFiles?.backPath || cccdPending?.back)
  if (!hasCccdFront || !hasCccdBack) errors.cccdDocument = 'REQUIRED'

  const cha = requireFamilyPerson(draft.giaDinh.cha)
  const me = requireFamilyPerson(draft.giaDinh.me)
  if (cha || me) errors.giaDinh = { ...(cha ? { cha } : {}), ...(me ? { me } : {}) }

  const noiSinh = mapAddress(draft.noiSinh, { cityOnly: true })
  if (noiSinh) errors.noiSinh = noiSinh
  const diaChiThuongTru = mapAddress(draft.diaChiThuongTru)
  if (diaChiThuongTru) errors.diaChiThuongTru = diaChiThuongTru
  const noiXuatGia = mapAddress(draft.noiXuatGia, { lineRequired: true })
  if (noiXuatGia) errors.noiXuatGia = noiXuatGia

  return { valid: Object.keys(errors).length === 0, errors }
}
