import type { Env } from './worker/env'
import { handleClientErrorsApi } from './worker/clientErrorsApi'
import { handleDataApi } from './worker/dataApi'
import { handleDirectoryRoleApi } from './worker/directoryRoleApi'
import { handleDocsApi } from './worker/docsApi'
import { handlePhotosApi } from './worker/photosApi'
import { handleSearchApi } from './worker/searchApi'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/health') {
      return Response.json({ ok: true })
    }
    if (url.pathname.startsWith('/api/photos')) {
      return handlePhotosApi(request, env)
    }
    if (url.pathname.startsWith('/api/docs')) {
      return handleDocsApi(request, env)
    }
    if (url.pathname === '/api/client-errors') {
      return handleClientErrorsApi(request)
    }
    if (url.pathname.startsWith('/api/admin/directory-role')) {
      return handleDirectoryRoleApi(request, env)
    }
    const dataResponse = await handleDataApi(request, env, ctx)
    if (dataResponse !== null) {
      return dataResponse
    }
    const searchResponse = await handleSearchApi(request, env)
    if (searchResponse !== null) {
      return searchResponse
    }
    if (url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 })
    }
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
