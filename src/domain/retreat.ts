import { DomainError } from './errors'

export type RetreatType = 'giao_doan' | 'he_phai'

export type RetreatStatus = 'draft' | 'open' | 'closed'

export type QuyenDangKy = 'tu_dang_ky' | 'proxy_only' | 'both'

export type RetreatExtraField = {
  key: string
  label: string
  required: boolean
}

export type Retreat = {
  id: string
  type: RetreatType
  orgUnitId: string
  name: string
  diaDiem: string
  noiDung: string
  doiTuongThamDu: string
  thoiGianBatDau: string
  thoiGianKetThuc: string
  dangKyMoTu: string
  dangKyDongLuc: string
  extraFields: RetreatExtraField[]
  quyenDangKy: QuyenDangKy
  status: RetreatStatus
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type RetreatWritableFields = Omit<
  Retreat,
  'id' | 'type' | 'orgUnitId' | 'status' | 'createdBy' | 'createdAt' | 'updatedAt'
>

const QUYEN_DANG_KY: readonly QuyenDangKy[] = [
  'tu_dang_ky',
  'proxy_only',
  'both',
]

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new DomainError('INVALID_INPUT', `${field} is required`)
  }
}

export function assertCanOpen(status: RetreatStatus): void {
  if (status !== 'draft' && status !== 'closed') {
    throw new DomainError('INVALID_STATUS', `Cannot open retreat with status ${status}`)
  }
}

export function assertCanClose(status: RetreatStatus): void {
  if (status !== 'open') {
    throw new DomainError('INVALID_STATUS', `Cannot close retreat with status ${status}`)
  }
}

export function assertCanDelete(status: RetreatStatus): void {
  if (status !== 'draft') {
    throw new DomainError('INVALID_STATUS', `Cannot delete retreat with status ${status}`)
  }
}

export function validateRetreatFields(fields: RetreatWritableFields): void {
  assertNonEmpty(fields.name, 'name')
  assertNonEmpty(fields.diaDiem, 'diaDiem')
  assertNonEmpty(fields.noiDung, 'noiDung')
  assertNonEmpty(fields.doiTuongThamDu, 'doiTuongThamDu')
  assertNonEmpty(fields.thoiGianBatDau, 'thoiGianBatDau')
  assertNonEmpty(fields.thoiGianKetThuc, 'thoiGianKetThuc')
  assertNonEmpty(fields.dangKyMoTu, 'dangKyMoTu')
  assertNonEmpty(fields.dangKyDongLuc, 'dangKyDongLuc')

  if (!(QUYEN_DANG_KY as readonly string[]).includes(fields.quyenDangKy)) {
    throw new DomainError('INVALID_INPUT', 'Invalid quyenDangKy')
  }

  const seen = new Set<string>()
  for (const field of fields.extraFields) {
    if (!field.key.trim()) {
      throw new DomainError('INVALID_INPUT', 'extraField key is required')
    }
    if (seen.has(field.key)) {
      throw new DomainError('INVALID_INPUT', 'Duplicate extraField key')
    }
    seen.add(field.key)
  }
}
