// @vitest-environment node
import { exportPKCS8, generateKeyPair } from 'jose'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = 'test-project'
const CLIENT_EMAIL = 'firebase-adminsdk@test-project.iam.gserviceaccount.com'

let privateKeyPem: string

beforeAll(async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true })
  privateKeyPem = await exportPKCS8(privateKey)
})

function sampleServiceAccountJson() {
  return JSON.stringify({
    type: 'service_account',
    project_id: PROJECT_ID,
    private_key: privateKeyPem,
    client_email: CLIENT_EMAIL,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('parseServiceAccountJson', () => {
  it('parses client email, private key, and project id', async () => {
    const { parseServiceAccountJson } = await import('./googleServiceAccount')
    const result = parseServiceAccountJson(sampleServiceAccountJson())

    expect(result).toEqual({
      clientEmail: CLIENT_EMAIL,
      privateKey: privateKeyPem,
      projectId: PROJECT_ID,
    })
  })
})

describe('getGoogleAccessToken', () => {
  it('requests an access token with JWT bearer grant and required scopes', async () => {
    const { parseServiceAccountJson, getGoogleAccessToken } = await import(
      './googleServiceAccount'
    )
    const sa = parseServiceAccountJson(sampleServiceAccountJson())

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        expect(url).toBe('https://oauth2.googleapis.com/token')
        expect(init?.method).toBe('POST')
        expect(init?.headers).toMatchObject({
          'Content-Type': 'application/x-www-form-urlencoded',
        })

        const body = init?.body?.toString() ?? ''
        expect(body).toContain(
          'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer',
        )
        const assertion = new URLSearchParams(body).get('assertion')
        expect(assertion).toBeTruthy()

        const [, payloadB64] = assertion!.split('.')
        const payload = JSON.parse(
          Buffer.from(payloadB64, 'base64url').toString('utf8'),
        )
        expect(payload.iss).toBe(CLIENT_EMAIL)
        expect(payload.sub).toBe(CLIENT_EMAIL)
        expect(payload.aud).toBe('https://oauth2.googleapis.com/token')
        expect(payload.scope).toBe(
          'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore',
        )

        return new Response(JSON.stringify({ access_token: 'ya29.test-token' }))
      }),
    )

    const token = await getGoogleAccessToken(sa)
    expect(token).toBe('ya29.test-token')
  })
})
