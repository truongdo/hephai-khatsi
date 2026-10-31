import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { gdAdmin } from '#/domain/authz/testFixtures'
import type { Env } from '../env'
import { handleDataApi } from './index'
import { clearData } from './test/db'

const workerEnv = {
  DB: env.DB,
  FIREBASE_PROJECT_ID: 'test-project',
  TYPESENSE_API_KEY: 'test-key',
} as unknown as Env

const executionCtx = { waitUntil: () => {} }

/** Accepts the token "gd-admin" only. */
async function verify(token: string) {
  return token === 'gd-admin' ? gdAdmin : null
}

function call(path: string, init: RequestInit = {}) {
  return handleDataApi(
    new Request(`https://app.test${path}`, init),
    workerEnv,
    executionCtx,
    verify,
  )
}

function post(name: string, body: unknown, headers: Record<string, string> = {}) {
  return call(`/api/data/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(clearData)

describe('handleDataApi', () => {
  it('ignores paths outside /api/data', async () => {
    expect(await call('/api/search', { method: 'POST' })).toBeNull()
  })

  it('serves the org units on a cacheable GET', async () => {
    const response = await call('/api/data/org-units/list')
    expect(response?.status).toBe(200)
    expect(response?.headers.get('Cache-Control')).toBe('public, max-age=300')
    expect(((await response?.json()) as unknown[]).length).toBeGreaterThan(0)
  })

  it('only accepts POST for other routes', async () => {
    expect((await call('/api/data/members/get'))?.status).toBe(405)
  })

  it('answers a public read without a token', async () => {
    const response = await post('members/get', { id: 'missing' })
    expect(response?.status).toBe(200)
    expect(response?.headers.get('Cache-Control')).toBe('no-store')
    expect(await response?.json()).toBeNull()
  })

  it.each([
    ['an unknown route', () => post('members/nope', {}), 404, 'NOT_FOUND'],
    ['invalid JSON', () => post('members/get', '{'), 400, 'INVALID_INPUT'],
    ['a body that is not an object', () => post('members/get', [1]), 400, 'INVALID_INPUT'],
    ['a missing field', () => post('members/get', {}), 400, 'INVALID_INPUT'],
    [
      'an ID token that does not verify',
      () => post('members/get', { id: 'x' }, { Authorization: 'Bearer forged' }),
      401,
      'UNAUTHORIZED',
    ],
    [
      'an authz deny',
      () => post('members/list', { sanghaType: 'tang' }, { Authorization: 'Bearer gd-admin' }),
      403,
      'FORBIDDEN',
    ],
  ])('maps %s to %i', async (_, send, status, code) => {
    const response = await send()
    expect(response?.status).toBe(status)
    expect(await response?.json()).toMatchObject({ code })
  })

  it('runs as the verified caller', async () => {
    const response = await post(
      'members/list',
      { sanghaType: 'tang', orgUnitId: 'gd-i' },
      { Authorization: 'Bearer gd-admin' },
    )
    expect(response?.status).toBe(200)
    expect(await response?.json()).toEqual({ items: [], nextCursor: null })
  })

  it('rejects an oversized body', async () => {
    const response = await post('members/get', { id: 'x'.repeat(1_100_000) })
    expect(response?.status).toBe(400)
  })
})
