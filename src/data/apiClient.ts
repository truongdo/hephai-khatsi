import { DomainError, isDomainErrorCode } from '#/domain/errors'
import { getCurrentUserIdToken } from '#/repositories/authRepo'

// Client of the Worker's /api/data/<route> (src/worker/dataApi). Staff calls
// carry the Firebase ID token; fillers are anonymous and name their invite
// token in the body where a route needs it. Errors come back as the same
// DomainError the Firestore repositories throw.

const PREFIX = '/api/data/'

export type DataApiBody = Record<string, unknown>

export type DataApiClient = {
  post<T>(route: string, body?: DataApiBody): Promise<T>
  /** Public routes the Worker also serves on GET (shared cache, so no token). */
  get<T>(route: string): Promise<T>
}

async function toError(route: string, response: Response): Promise<Error> {
  const body: unknown = await response.json().catch(() => null)
  if (typeof body === 'object' && body !== null && 'code' in body && isDomainErrorCode(body.code)) {
    const message = 'message' in body && typeof body.message === 'string' ? body.message : body.code
    return new DomainError(body.code, message)
  }
  return new Error(`Data API ${route} failed (${response.status})`)
}

export function createDataApiClient(getIdToken: () => Promise<string | null>): DataApiClient {
  async function request<T>(route: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${PREFIX}${route}`, init)
    if (!response.ok) throw await toError(route, response)
    return (await response.json()) as T
  }

  return {
    async post<T>(route: string, body: DataApiBody = {}): Promise<T> {
      const idToken = await getIdToken()
      const init = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify(body),
      }
      try {
        return await request<T>(route, init)
      } catch (error) {
        // A lost race on the version guard: the Worker re-reads, so one retry
        // behaves like a Firestore transaction retry.
        if (error instanceof DomainError && error.code === 'CONFLICT') return request<T>(route, init)
        throw error
      }
    },
    get<T>(route: string): Promise<T> {
      return request<T>(route, { method: 'GET' })
    },
  }
}

export const dataApi: DataApiClient = createDataApiClient(getCurrentUserIdToken)
