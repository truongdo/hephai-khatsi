import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMemberPhotoDownloadUrl } from './memberPhotoUrl'

describe('getMemberPhotoDownloadUrl', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PHOTOS_PUBLIC_BASE', 'https://cdn.example.com')
  })

  it('joins public base and photo path', () => {
    expect(getMemberPhotoDownloadUrl('members/m1/photo.jpg')).toBe(
      'https://cdn.example.com/members/m1/photo.jpg',
    )
  })

  it('strips trailing slash from base and leading slash from path', () => {
    vi.stubEnv('VITE_PHOTOS_PUBLIC_BASE', 'https://cdn.example.com/')
    expect(getMemberPhotoDownloadUrl('/members/m1/photo.jpg')).toBe(
      'https://cdn.example.com/members/m1/photo.jpg',
    )
  })

  it('throws when VITE_PHOTOS_PUBLIC_BASE is not configured', () => {
    vi.stubEnv('VITE_PHOTOS_PUBLIC_BASE', '')
    expect(() => getMemberPhotoDownloadUrl('members/m1/photo.jpg')).toThrow(
      /VITE_PHOTOS_PUBLIC_BASE/,
    )
  })
})
