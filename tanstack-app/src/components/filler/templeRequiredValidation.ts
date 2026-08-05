import type { AddressDraft } from '#/domain/address'
import { validateAddressDraft } from '#/domain/address'
import { isBasicEmail, requireVnPhone } from './memberRequiredValidation'
import type { NumericValue } from './templeDraft'

export type TempleRequiredDraft = {
  danhHieu: string
  nguoiKhaiSon: string
  namThanhLap: string
  diaChiCu: string
  diaChiMoi: AddressDraft
  truTriHienNay: { phapDanh: string; dienThoai: string; email: string }
  truTriTienNhiem: Array<{ phapDanh: string; thoiGian: string; ghiChu: string }>
  tangSoHienTru: {
    tyKheo: NumericValue
    thucXoaMaNa: NumericValue
    saDi: NumericValue
    tapSu: NumericValue
  }
  soPhatTuQuyY: NumericValue
  soPhatTuThuongXuyen: NumericValue
  hasPhoto: boolean
  /** Optional additional manager phone — validated only when non-empty. */
  extraManagerPhone?: string
}

export type TempleRequiredFieldErrors = {
  danhHieu?: 'REQUIRED'
  nguoiKhaiSon?: 'REQUIRED'
  namThanhLap?: 'REQUIRED'
  diaChiCu?: 'REQUIRED'
  diaChiMoi?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  truTriHienNay?: {
    phapDanh?: 'REQUIRED'
    dienThoai?: 'REQUIRED' | 'INVALID'
    email?: 'REQUIRED' | 'INVALID'
  }
  truTriTienNhiem?: 'REQUIRED' | Array<{ phapDanh?: 'REQUIRED' } | undefined>
  tangSoHienTru?: {
    tyKheo?: 'REQUIRED'
    thucXoaMaNa?: 'REQUIRED'
    saDi?: 'REQUIRED'
    tapSu?: 'REQUIRED'
  }
  soPhatTuQuyY?: 'REQUIRED'
  soPhatTuThuongXuyen?: 'REQUIRED'
  photo?: 'REQUIRED'
  extraManagerPhone?: 'INVALID'
}

function requireText(value: string): 'REQUIRED' | undefined {
  return value.trim() ? undefined : 'REQUIRED'
}

function requireNumber(value: NumericValue): 'REQUIRED' | undefined {
  return typeof value === 'number' ? undefined : 'REQUIRED'
}

function mapAddress(
  draft: AddressDraft,
): { city?: 'REQUIRED'; ward?: 'REQUIRED' } | undefined {
  const result = validateAddressDraft(draft, { required: true })
  if (result.valid) return undefined
  return result.errors
}

export function validateTempleRequiredFields(draft: TempleRequiredDraft): {
  valid: boolean
  errors: TempleRequiredFieldErrors
} {
  const errors: TempleRequiredFieldErrors = {}

  const danhHieu = requireText(draft.danhHieu)
  if (danhHieu) errors.danhHieu = danhHieu
  const nguoiKhaiSon = requireText(draft.nguoiKhaiSon)
  if (nguoiKhaiSon) errors.nguoiKhaiSon = nguoiKhaiSon
  const namThanhLap = requireText(draft.namThanhLap)
  if (namThanhLap) errors.namThanhLap = namThanhLap

  const diaChiCu = requireText(draft.diaChiCu)
  if (diaChiCu) errors.diaChiCu = diaChiCu
  const diaChiMoi = mapAddress(draft.diaChiMoi)
  if (diaChiMoi) errors.diaChiMoi = diaChiMoi

  const truTri: NonNullable<TempleRequiredFieldErrors['truTriHienNay']> = {}
  const phapDanh = requireText(draft.truTriHienNay.phapDanh)
  if (phapDanh) truTri.phapDanh = phapDanh
  const dienThoai = requireVnPhone(draft.truTriHienNay.dienThoai)
  if (dienThoai) truTri.dienThoai = dienThoai
  const emailTrimmed = draft.truTriHienNay.email.trim()
  if (!emailTrimmed) truTri.email = 'REQUIRED'
  else if (!isBasicEmail(emailTrimmed)) truTri.email = 'INVALID'
  if (Object.keys(truTri).length > 0) errors.truTriHienNay = truTri

  const extraPhone = requireVnPhone(draft.extraManagerPhone ?? '', {
    required: false,
  })
  if (extraPhone === 'INVALID') errors.extraManagerPhone = 'INVALID'

  if (draft.truTriTienNhiem.length === 0) {
    errors.truTriTienNhiem = 'REQUIRED'
  } else {
    const rowErrors = draft.truTriTienNhiem.map((row) => {
      const rowPhapDanh = requireText(row.phapDanh)
      return rowPhapDanh ? { phapDanh: rowPhapDanh } : undefined
    })
    if (rowErrors.some(Boolean)) errors.truTriTienNhiem = rowErrors
  }

  const tangSo: NonNullable<TempleRequiredFieldErrors['tangSoHienTru']> = {}
  const tyKheo = requireNumber(draft.tangSoHienTru.tyKheo)
  if (tyKheo) tangSo.tyKheo = tyKheo
  const thucXoaMaNa = requireNumber(draft.tangSoHienTru.thucXoaMaNa)
  if (thucXoaMaNa) tangSo.thucXoaMaNa = thucXoaMaNa
  const saDi = requireNumber(draft.tangSoHienTru.saDi)
  if (saDi) tangSo.saDi = saDi
  const tapSu = requireNumber(draft.tangSoHienTru.tapSu)
  if (tapSu) tangSo.tapSu = tapSu
  if (Object.keys(tangSo).length > 0) errors.tangSoHienTru = tangSo

  const soPhatTuQuyY = requireNumber(draft.soPhatTuQuyY)
  if (soPhatTuQuyY) errors.soPhatTuQuyY = soPhatTuQuyY
  const soPhatTuThuongXuyen = requireNumber(draft.soPhatTuThuongXuyen)
  if (soPhatTuThuongXuyen) errors.soPhatTuThuongXuyen = soPhatTuThuongXuyen

  if (!draft.hasPhoto) errors.photo = 'REQUIRED'

  return { valid: Object.keys(errors).length === 0, errors }
}
