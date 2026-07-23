import { getDownloadURL, ref } from 'firebase/storage'
import { getClientStorage } from '#/firebase/storage'

export async function getMemberPhotoDownloadUrl(
  photoPath: string,
): Promise<string> {
  const storage = getClientStorage()
  if (!storage) throw new Error('Storage is not configured')
  return getDownloadURL(ref(storage, photoPath))
}
