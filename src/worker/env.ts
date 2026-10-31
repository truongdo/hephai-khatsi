export type Env = {
  ASSETS: Fetcher
  PHOTOS: R2Bucket
  DB: D1Database
  R2_ACCOUNT_ID: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_BUCKET_NAME: string
  FIREBASE_PROJECT_ID: string
  FIREBASE_SERVICE_ACCOUNT_JSON: string
  TYPESENSE_API_KEY: string
  TYPESENSE_HOST?: string
  /**
   * Which database the app reads and writes (`wrangler.jsonc` vars). Until the
   * cutover it is `firestore`: `/api/data/*` is off and the photo, document,
   * search and directory-role routes read Firestore.
   */
  DATA_BACKEND?: DataBackend
}

export type DataBackend = 'firestore' | 'd1'

export function usesD1(env: Pick<Env, 'DATA_BACKEND'>): boolean {
  return env.DATA_BACKEND === 'd1'
}
