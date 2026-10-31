import type { RecordFiles } from './context'

/**
 * The R2 side of member / temple writes (bucket `PHOTOS`). Deletes run after
 * the response (`ctx.waitUntil`): a failure is logged and leaves an orphan
 * object, never a record pointing at a missing file.
 */
export function createRecordFiles(
  bucket: R2Bucket,
  waitUntil: (promise: Promise<unknown>) => void,
): RecordFiles {
  return {
    async copy(from, to) {
      const object = await bucket.get(from)
      if (!object) return
      await bucket.put(to, object.body, { httpMetadata: object.httpMetadata })
    },
    async exists(path) {
      return (await bucket.head(path)) !== null
    },
    deleteLater(paths) {
      if (paths.length === 0) return
      waitUntil(
        bucket.delete(paths).catch((error: unknown) => {
          console.error('[record-files] delete failed', error)
        }),
      )
    },
  }
}
