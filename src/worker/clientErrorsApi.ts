const MAX_BODY_BYTES = 4096

const STRING_FIELDS = {
  ref: 16,
  form: 32,
  stage: 32,
  reason: 32,
  code: 64,
  message: 300,
  orgUnitId: 64,
  sanghaType: 32,
  recordId: 64,
  signedInRole: 32,
  path: 200,
  userAgent: 300,
  at: 40,
} as const

type ClientErrorReport = Partial<Record<keyof typeof STRING_FIELDS, string>> & {
  online?: boolean
}

export function sanitizeClientErrorReport(body: unknown): ClientErrorReport | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null
  }
  const input = body as Record<string, unknown>
  if (typeof input.ref !== 'string' || !input.ref) return null

  const report: ClientErrorReport = {}
  for (const [key, max] of Object.entries(STRING_FIELDS) as Array<
    [keyof typeof STRING_FIELDS, number]
  >) {
    const value = input[key]
    if (typeof value === 'string' && value) report[key] = value.slice(0, max)
  }
  if (typeof input.online === 'boolean') report.online = input.online
  return report
}

/**
 * Receives failure reports from the public forms and writes them to Workers
 * Logs as one JSON line (filter by `type = client_error` or by `ref`).
 * Unauthenticated by design: the visitor has no account.
 */
export async function handleClientErrorsApi(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  const length = Number(request.headers.get('Content-Length') ?? '0')
  if (length > MAX_BODY_BYTES) {
    return new Response('Payload too large', { status: 413 })
  }

  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) {
    return new Response('Payload too large', { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const report = sanitizeClientErrorReport(body)
  if (!report) {
    return new Response('Invalid report', { status: 400 })
  }

  const cf = (request as Request & { cf?: { country?: string; colo?: string } }).cf
  console.error(
    JSON.stringify({
      type: 'client_error',
      ...report,
      country: cf?.country,
      colo: cf?.colo,
    }),
  )
  return new Response(null, { status: 204 })
}
