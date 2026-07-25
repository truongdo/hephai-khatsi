import type { Env } from './worker/env'
import { handlePhotosApi } from './worker/photosApi'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/health') {
      return Response.json({ ok: true })
    }
    if (url.pathname.startsWith('/api/photos')) {
      return handlePhotosApi(request, env)
    }
    if (url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 })
    }
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
