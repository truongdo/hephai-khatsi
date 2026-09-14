import type { Member } from '#/domain/types'

function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function memberPdfSlug(
  member: Pick<Member, 'phapDanh' | 'theDanh'> | { phapDanh?: string; theDanh?: string },
): string {
  const raw = (member.phapDanh?.trim() || member.theDanh?.trim() || 'member')
  const ascii = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return ascii || 'member'
}

export function memberPdfFilename(
  member: Pick<Member, 'id' | 'phapDanh' | 'theDanh'>,
): string {
  return `HoSo_${memberPdfSlug(member)}_${member.id}.pdf`
}

export function membersMergedPdfFilename(date: Date = new Date()): string {
  return `HoSoMembers_${formatLocalDate(date)}.pdf`
}

export function membersPdfZipFilename(date: Date = new Date()): string {
  return `HoSoMembers_${formatLocalDate(date)}.zip`
}

export function memberPdfZipFolder(
  member: Pick<Member, 'id' | 'phapDanh' | 'theDanh'>,
): string {
  return `${memberPdfSlug(member)}_${member.id}`
}

export function memberPdfZipDocEntry(
  folder: string,
  typeId: string,
  side: string,
  ext: string,
): string {
  return `${folder}/documents/${typeId}_${side}.${ext}`
}

export function extFromObjectKeyOrType(
  objectKey: string,
  contentType?: string | null,
): string {
  const fromKey = objectKey.split('.').pop()?.toLowerCase()
  if (fromKey && /^[a-z0-9]{2,5}$/.test(fromKey) && fromKey !== objectKey) {
    return fromKey === 'jpeg' ? 'jpg' : fromKey
  }
  if (contentType === 'application/pdf') return 'pdf'
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') return 'jpg'
  return 'bin'
}
