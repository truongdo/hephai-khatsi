export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isGmailEmail(email: string | null | undefined): boolean {
  if (email == null) return false
  const normalized = normalizeEmail(email)
  const at = normalized.lastIndexOf('@')
  if (at <= 0) return false
  return normalized.slice(at) === '@gmail.com'
}
