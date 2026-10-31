import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { createRecordFiles } from './recordFiles'

describe('createRecordFiles', () => {
  it('copies an object with its content type and deletes after the response', async () => {
    const pending: Promise<unknown>[] = []
    const files = createRecordFiles(env.PHOTOS, (promise) => void pending.push(promise))
    await env.PHOTOS.put('members/a/photo.jpg', 'jpeg-bytes', { httpMetadata: { contentType: 'image/jpeg' } })

    await files.copy('members/a/photo.jpg', 'members/b/photo.jpg')
    await files.copy('members/a/missing.jpg', 'members/b/missing.jpg')
    const copied = await env.PHOTOS.get('members/b/photo.jpg')
    expect(await copied?.text()).toBe('jpeg-bytes')
    expect(copied?.httpMetadata?.contentType).toBe('image/jpeg')
    expect(await env.PHOTOS.head('members/b/missing.jpg')).toBeNull()

    files.deleteLater(['members/a/photo.jpg'])
    files.deleteLater([])
    expect(pending).toHaveLength(1)
    await Promise.all(pending)
    expect(await env.PHOTOS.head('members/a/photo.jpg')).toBeNull()
  })
})
