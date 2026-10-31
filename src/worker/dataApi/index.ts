import { DomainError } from '#/domain/errors'
import type { Env } from '../env'
import { verifyFirebaseUser } from '../verifyFirebaseAdmin'
import type { DataContext } from './context'
import { auditLogRoutes } from './handlers/auditLogs'
import { inviteRoutes } from './handlers/invites'
import { memberRoutes } from './handlers/members'
import { orgUnitRoutes } from './handlers/orgUnits'
import { registrationRoutes } from './handlers/registrations'
import { retreatRoutes } from './handlers/retreats'
import { statsRoutes } from './handlers/stats'
import { templeRoutes } from './handlers/temples'
import { errorResponse, readJsonBody, resolveCaller, type VerifyIdToken } from './http'
import type { Body } from './input'
import type { DataRoute } from './route'
import { createRecordFiles } from './recordFiles'
import { createSearchSync } from './searchSync'

// /api/data/<name>: the client repositories' calls to D1
// (see docs/superpowers/plans/2026-10-30-firestore-to-d1-migration.md). Every
// route is a POST of a JSON body (org units also answer GET, cacheable);
// staff send `Authorization: Bearer <Firebase ID token>`, fillers nothing.

const PREFIX = '/api/data/'

export const DATA_ROUTES: Record<string, DataRoute> = {
  ...orgUnitRoutes,
  ...inviteRoutes,
  ...memberRoutes,
  ...templeRoutes,
  ...retreatRoutes,
  ...registrationRoutes,
  ...auditLogRoutes,
  ...statsRoutes,
}

/** Public, rarely changing reads served on GET with a short shared cache. */
const CACHEABLE_GET_ROUTES = new Set(['org-units/list'])

/** Runs a route by name (the HTTP handler and the D1 tests both use it). */
export async function runDataRoute(name: string, body: Body, ctx: DataContext): Promise<unknown> {
  const dataRoute = DATA_ROUTES[name]
  if (!dataRoute) throw new DomainError('NOT_FOUND', `Unknown data route ${name}`)
  return dataRoute(body, ctx)
}

export async function handleDataApi(
  request: Request,
  env: Env,
  executionCtx: Pick<ExecutionContext, 'waitUntil'>,
  verify: VerifyIdToken = (token) => verifyFirebaseUser(token, env.FIREBASE_PROJECT_ID),
): Promise<Response | null> {
  const { pathname } = new URL(request.url)
  if (!pathname.startsWith(PREFIX)) return null

  const name = pathname.slice(PREFIX.length)
  const isCacheableGet = request.method === 'GET' && CACHEABLE_GET_ROUTES.has(name)
  if (request.method !== 'POST' && !isCacheableGet) {
    return new Response('Method not allowed', { status: 405 })
  }
  try {
    const ctx: DataContext = {
      db: env.DB,
      caller: await resolveCaller(request, verify),
      now: new Date().toISOString(),
      search: createSearchSync(env, (promise) => executionCtx.waitUntil(promise)),
      files: createRecordFiles(env.PHOTOS, (promise) => executionCtx.waitUntil(promise)),
    }
    const result = await runDataRoute(name, await readJsonBody(request), ctx)
    return Response.json(result, {
      headers: isCacheableGet ? { 'Cache-Control': 'public, max-age=300' } : { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
