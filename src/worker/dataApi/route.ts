import type { DataContext } from './context'
import type { Body } from './input'

/** One `/api/data/<name>` endpoint: the JSON body in, the JSON result out. */
export type DataRoute = (body: Body, ctx: DataContext) => Promise<unknown>

/** Validates the body with `parse` before `handle` runs. */
export function route<I>(
  parse: (body: Body) => I,
  handle: (ctx: DataContext, input: I) => Promise<unknown>,
): DataRoute {
  return (body, ctx) => handle(ctx, parse(body))
}
