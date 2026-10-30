import { AwsClient } from 'aws4fetch'

export function memberPhotoKey(memberId: string): string {
  return `members/${memberId}/photo.jpg`
}

export function templePhotoKey(templeId: string): string {
  return `temples/${templeId}/photo.jpg`
}

export function memberDocumentKey(
  memberId: string,
  typeId: string,
  side: string,
  ext: string,
): string {
  return `members/${memberId}/docs/${typeId}/${side}.${ext}`
}

export async function createR2PresignedPutUrl(input: {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  key: string
  contentType: string
  expiresSeconds: number
}): Promise<string> {
  const {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    key,
    contentType,
    expiresSeconds,
  } = input

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region: 'auto',
  })

  const url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}?X-Amz-Expires=${expiresSeconds}`
  const signed = await client.sign(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    aws: { signQuery: true },
  })

  return signed.url
}
