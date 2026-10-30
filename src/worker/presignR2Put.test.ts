// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createR2PresignedPutUrl } from './presignR2Put'

describe('createR2PresignedPutUrl', () => {
  it('returns a presigned PUT URL on the R2 bucket endpoint', async () => {
    const accountId = 'abc123account'
    const bucket = 'member-photos'
    const key = 'members/m1/photo.jpg'

    const url = await createR2PresignedPutUrl({
      accountId,
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      bucket,
      key,
      contentType: 'image/jpeg',
      expiresSeconds: 300,
    })

    const parsed = new URL(url)
    expect(parsed.hostname).toBe(`${accountId}.r2.cloudflarestorage.com`)
    expect(parsed.pathname).toBe(`/${bucket}/${key}`)
    expect(parsed.searchParams.get('X-Amz-Expires')).toBe('300')
    expect(parsed.searchParams.has('X-Amz-Signature')).toBe(true)
  })
})
