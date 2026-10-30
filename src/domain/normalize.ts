import { DomainError } from './errors'

export function normalizeCccd(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) throw new DomainError('CCCD_REQUIRED', 'CCCD is required')
  if (digits.length < 9 || digits.length > 12) {
    throw new DomainError('CCCD_INVALID', 'CCCD must be 9–12 digits')
  }
  return digits
}

/** Uppercase Thế danh / Pháp danh on blur or save. */
export function normalizeMemberDanh(raw: string): string {
  return raw.toLocaleUpperCase('vi-VN')
}

/** Trim and uppercase Thế danh / Pháp danh for Firestore storage. */
export function normalizeMemberDanhForStorage(
  raw: string,
): string | undefined {
  const trimmed = raw.trim()
  return trimmed ? trimmed.toLocaleUpperCase('vi-VN') : undefined
}

export function normalizeVnPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('84') && digits.length >= 11) {
    digits = `0${digits.slice(2)}`
  }
  if (!/^0\d{9,10}$/.test(digits)) {
    throw new DomainError('PHONE_INVALID', 'Invalid Vietnam phone number')
  }
  return digits
}
