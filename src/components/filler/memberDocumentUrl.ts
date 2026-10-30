export function getMemberDocumentDownloadUrl(
  filePath: string,
  cacheBust?: string | number | null,
): string {
  const base = import.meta.env.VITE_PHOTOS_PUBLIC_BASE
  if (!base) throw new Error('VITE_PHOTOS_PUBLIC_BASE is not configured')
  const url = `${base.replace(/\/$/, '')}/${filePath.replace(/^\//, '')}`
  if (cacheBust == null || cacheBust === '') return url
  return `${url}?v=${encodeURIComponent(String(cacheBust))}`
}
