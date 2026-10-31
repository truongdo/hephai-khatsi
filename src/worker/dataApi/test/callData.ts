import { env } from 'cloudflare:workers'
import { expect } from 'vitest'
import type { Caller } from '#/domain/authz/caller'
import { isDomainError, type DomainErrorCode } from '#/domain/errors'
import type { SearchSync } from '../context'
import { runDataRoute } from '../index'
import type { Body } from '../input'

export const NOW = '2026-07-25T03:00:00.000Z'

export type SearchCall = { action: keyof SearchSync; id: string }

/** Typesense calls the handlers made, in order. */
export const searchCalls: SearchCall[] = []

const recordingSearch: SearchSync = {
  upsertMember: (member) => searchCalls.push({ action: 'upsertMember', id: member.id }),
  upsertTemple: (temple) => searchCalls.push({ action: 'upsertTemple', id: temple.id }),
  deleteMember: (id) => searchCalls.push({ action: 'deleteMember', id }),
  deleteTemple: (id) => searchCalls.push({ action: 'deleteTemple', id }),
}

/** Calls a data route against the test D1 as `caller`; call `searchCalls.length = 0` in beforeEach. */
export function callData<T = unknown>(
  name: string,
  body: Body,
  caller: Caller = null,
  now: string = NOW,
): Promise<T> {
  return runDataRoute(name, body, { db: env.DB, caller, now, search: recordingSearch }) as Promise<T>
}

export async function expectDomainError(promise: Promise<unknown>, code: DomainErrorCode): Promise<void> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  )
  expect(isDomainError(error) ? error.code : error).toBe(code)
}

type LoggedQuery = { sql: string; params: unknown[] }

/** The D1 binding, recording each statement it binds. */
function loggingDb(log: LoggedQuery[]): D1Database {
  const db = env.DB
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'prepare') {
        return (sql: string) => {
          const statement = target.prepare(sql)
          return new Proxy(statement, {
            get(stmt, stmtProp) {
              if (stmtProp === 'bind') {
                return (...params: unknown[]) => {
                  log.push({ sql, params })
                  return stmt.bind(...params)
                }
              }
              const value = Reflect.get(stmt, stmtProp)
              return typeof value === 'function' ? value.bind(stmt) : value
            },
          })
        }
      }
      const value = Reflect.get(target, prop)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

/**
 * `EXPLAIN QUERY PLAN` of every SELECT a route runs. A plain `SCAN <table>`
 * line (no index) means a full table scan.
 */
export async function queryPlansOf(name: string, body: Body, caller: Caller): Promise<string[][]> {
  const log: LoggedQuery[] = []
  await runDataRoute(name, body, { db: loggingDb(log), caller, now: NOW, search: recordingSearch })
  const plans: string[][] = []
  for (const query of log.filter((entry) => entry.sql.trimStart().startsWith('SELECT'))) {
    const { results } = await env.DB.prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
      .bind(...query.params)
      .all<{ detail: string }>()
    plans.push(results.map((row) => row.detail))
  }
  return plans
}

export function fullTableScans(plans: string[][]): string[] {
  return plans.flat().filter((line) => /^SCAN \w+( AS \w+)?$/.test(line))
}
