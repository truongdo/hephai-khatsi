import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage, path: string) => ({ fullPath: path })),
  getDownloadURL: vi.fn(async () => 'https://example.com/photo.jpg'),
}))

vi.mock('#/firebase/storage', () => ({
  getClientStorage: vi.fn(() => ({ app: {} })),
}))

import { getDownloadURL } from 'firebase/storage'
import { getMemberPhotoDownloadUrl } from './memberPhotoUrl'

describe('getMemberPhotoDownloadUrl', () => {
  beforeEach(() => {
    vi.mocked(getDownloadURL).mockClear()
  })

  it('returns download URL for a storage path', async () => {
    await expect(
      getMemberPhotoDownloadUrl('members/m1/photo.jpg'),
    ).resolves.toBe('https://example.com/photo.jpg')
    expect(getDownloadURL).toHaveBeenCalled()
  })

  it('throws when storage is not configured', async () => {
    const { getClientStorage } = await import('#/firebase/storage')
    vi.mocked(getClientStorage).mockReturnValueOnce(null)
    await expect(
      getMemberPhotoDownloadUrl('members/m1/photo.jpg'),
    ).rejects.toThrow(/Storage/)
  })
})
