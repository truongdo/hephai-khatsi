import * as Sentry from '@sentry/react'

/** Drops the query string: public-form URLs carry the visitor's phone number. */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/)
  return cut === -1 ? url : url.slice(0, cut)
}

export function scrubEvent<T extends Sentry.Event>(event: T): T {
  if (event.request?.url) {
    event.request.url = stripQuery(event.request.url)
  }
  if (event.request) {
    delete event.request.query_string
  }
  return event
}

export function scrubBreadcrumb(
  breadcrumb: Sentry.Breadcrumb,
): Sentry.Breadcrumb {
  const data = breadcrumb.data
  if (!data) return breadcrumb
  for (const key of ['url', 'from', 'to'] as const) {
    if (typeof data[key] === 'string') data[key] = stripQuery(data[key])
  }
  return breadcrumb
}

type StreamedSpan = Parameters<NonNullable<Sentry.BrowserOptions['beforeSendSpan']>>[0]

const URL_LIKE = /^(https?:\/\/|\/)/

function scrubAttributeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return URL_LIKE.test(value) ? stripQuery(value) : value
  }
  if (value && typeof value === 'object' && 'value' in value) {
    const inner = (value as { value: unknown }).value
    return { ...value, value: scrubAttributeValue(inner) }
  }
  return value
}

/** Spans (page loads, fetches) carry URLs too; strip their query strings. */
export function scrubSpan(span: StreamedSpan): StreamedSpan {
  const attributes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(span.attributes)) {
    if (/query/i.test(key)) continue
    attributes[key] = scrubAttributeValue(value)
  }
  return {
    ...span,
    // Names look like "GET /api/x?phone=…" or "/f/public/edit?phone=…".
    name: span.name.replace(/[?#]\S*/g, ''),
    attributes: attributes as StreamedSpan['attributes'],
  }
}

type TracedRouter = Parameters<
  typeof Sentry.tanstackRouterBrowserTracingIntegration
>[0]

export function initSentry(router: TracedRouter): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    // Same-origin only (/api on the Worker). Adding trace headers to Firestore
    // or Google APIs would break their CORS preflight.
    tracePropagationTargets: [/^\//],
    beforeSend: scrubEvent,
    beforeSendSpan: scrubSpan,
    beforeBreadcrumb: scrubBreadcrumb,
  })
}

/** React 19 root error hooks; no-ops when Sentry is not configured. */
export const sentryRootErrorHandlers = {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}
