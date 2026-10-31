export type Env = {
  ASSETS: Fetcher
  PHOTOS: R2Bucket
  DB: D1Database
  FIREBASE_PROJECT_ID: string
  FIREBASE_SERVICE_ACCOUNT_JSON: string
  TYPESENSE_API_KEY: string
  TYPESENSE_HOST?: string
}
