import { isDomainError } from '#/domain/errors'
import { normalizeCccd } from '#/domain/normalize'

export function memberIdentityMatches(
  member: { cccd: string; ngaySinh?: string },
  input: { cccd: string; ngaySinh: string },
): boolean {
  const storedDob = member.ngaySinh?.trim() ?? ''
  if (!storedDob) return false
  if (!input.ngaySinh.trim()) return false

  let normalized: string
  try {
    normalized = normalizeCccd(input.cccd)
  } catch (err) {
    if (isDomainError(err)) return false
    throw err
  }

  return normalized === member.cccd && input.ngaySinh === storedDob
}
