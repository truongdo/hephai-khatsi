export function getMemberPhotoDownloadUrl(photoPath: string): string {
  const base = import.meta.env.VITE_PHOTOS_PUBLIC_BASE
  if (!base) throw new Error('VITE_PHOTOS_PUBLIC_BASE is not configured')
  return `${base.replace(/\/$/, '')}/${photoPath.replace(/^\//, '')}`
}
