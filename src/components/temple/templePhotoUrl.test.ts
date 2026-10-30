import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTemplePhotoDownloadUrl } from './templePhotoUrl'

describe('getTemplePhotoDownloadUrl', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PHOTOS_PUBLIC_BASE', 'https://cdn.example.com')
  })

  it('joins public base and photo path', () => {
    expect(getTemplePhotoDownloadUrl('temples/t1/photo.jpg')).toBe(
      'https://cdn.example.com/temples/t1/photo.jpg',
    )
  })

  it('strips trailing slash from base and leading slash from path', () => {
    vi.stubEnv('VITE_PHOTOS_PUBLIC_BASE', 'https://cdn.example.com/')
    expect(getTemplePhotoDownloadUrl('/temples/t1/photo.jpg')).toBe(
      'https://cdn.example.com/temples/t1/photo.jpg',
    )
  })

  it('throws when VITE_PHOTOS_PUBLIC_BASE is not configured', () => {
    vi.stubEnv('VITE_PHOTOS_PUBLIC_BASE', '')
    expect(() => getTemplePhotoDownloadUrl('temples/t1/photo.jpg')).toThrow(
      /VITE_PHOTOS_PUBLIC_BASE/,
    )
  })

  it('appends cache bust query when provided', () => {
    expect(getTemplePhotoDownloadUrl('temples/t1/photo.jpg', 1721900000000)).toBe(
      'https://cdn.example.com/temples/t1/photo.jpg?v=1721900000000',
    )
  })
})
