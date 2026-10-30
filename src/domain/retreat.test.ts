import { describe, expect, it } from 'vitest'
import { DomainError } from './errors'
import {
  assertCanClose,
  assertCanDelete,
  assertCanOpen,
  validateRetreatFields,
  type RetreatWritableFields,
} from './retreat'

const validFields = (): RetreatWritableFields => ({
  name: 'Khóa tu hè',
  diaDiem: 'TX Trung Tâm',
  noiDung: 'Thiền',
  doiTuongThamDu: 'Tăng ni',
  thoiGianBatDau: '2026-08-01T00:00:00.000Z',
  thoiGianKetThuc: '2026-08-07T00:00:00.000Z',
  dangKyMoTu: '2026-07-01T00:00:00.000Z',
  dangKyDongLuc: '2026-07-20T00:00:00.000Z',
  extraFields: [{ key: 'phong', label: 'Phòng', required: false }],
  quyenDangKy: 'both',
})

describe('assertCanOpen', () => {
  it('allows draft and closed', () => {
    expect(() => assertCanOpen('draft')).not.toThrow()
    expect(() => assertCanOpen('closed')).not.toThrow()
  })
  it('rejects open', () => {
    expect(() => assertCanOpen('open')).toThrow(DomainError)
  })
})

describe('assertCanClose', () => {
  it('allows open only', () => {
    expect(() => assertCanClose('open')).not.toThrow()
    expect(() => assertCanClose('draft')).toThrow(DomainError)
  })
})

describe('assertCanDelete', () => {
  it('allows draft only', () => {
    expect(() => assertCanDelete('draft')).not.toThrow()
    expect(() => assertCanDelete('open')).toThrow(DomainError)
  })
})

describe('validateRetreatFields', () => {
  it('accepts valid fields', () => {
    expect(() => validateRetreatFields(validFields())).not.toThrow()
  })
  it('rejects empty name', () => {
    expect(() =>
      validateRetreatFields({ ...validFields(), name: '  ' }),
    ).toThrow(DomainError)
  })
  it('rejects duplicate extraField keys', () => {
    expect(() =>
      validateRetreatFields({
        ...validFields(),
        extraFields: [
          { key: 'a', label: 'A', required: true },
          { key: 'a', label: 'B', required: false },
        ],
      }),
    ).toThrow(DomainError)
  })
})
