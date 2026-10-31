import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DomainError } from '#/domain/errors'
import { createDataApiClient } from './apiClient'

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

describe('createDataApiClient', () => {
  it('POSTs the body with the ID token of the signed-in user', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 'm1' }))
    const api = createDataApiClient(async () => 'id-token')

    expect(await api.post('members/get', { id: 'm1' })).toEqual({ id: 'm1' })
    expect(fetchMock).toHaveBeenCalledWith('/api/data/members/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer id-token' },
      body: JSON.stringify({ id: 'm1' }),
    })
  })

  it('sends no Authorization header when signed out', async () => {
    fetchMock.mockResolvedValueOnce(json(null))
    await createDataApiClient(async () => null).post('members/get', { id: 'm1' })
    expect(fetchMock.mock.calls[0]![1]!.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('GETs public routes without a token', async () => {
    fetchMock.mockResolvedValueOnce(json([]))
    const getIdToken = vi.fn(async () => 'id-token')
    await createDataApiClient(getIdToken).get('org-units/list')
    expect(fetchMock).toHaveBeenCalledWith('/api/data/org-units/list', { method: 'GET' })
    expect(getIdToken).not.toHaveBeenCalled()
  })

  it('rethrows a Worker error as the DomainError of its code', async () => {
    fetchMock.mockResolvedValueOnce(json({ code: 'RECORD_LOCKED', message: 'Member is locked' }, 409))
    const error = await createDataApiClient(async () => null)
      .post('members/save-draft')
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(DomainError)
    expect(error).toMatchObject({ code: 'RECORD_LOCKED', message: 'Member is locked' })
  })

  it('throws a plain Error for other failures', async () => {
    fetchMock.mockResolvedValueOnce(json({ code: 'INTERNAL', message: 'Internal server error' }, 500))
    const error = await createDataApiClient(async () => null)
      .post('members/list')
      .catch((caught: unknown) => caught)
    expect(error).not.toBeInstanceOf(DomainError)
    expect((error as Error).message).toBe('Data API members/list failed (500)')
  })

  it('retries a write once after a version conflict', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ code: 'CONFLICT', message: 'changed' }, 409))
      .mockResolvedValueOnce(json({ id: 'm1' }))
    expect(await createDataApiClient(async () => null).post('members/lock')).toEqual({ id: 'm1' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up after a second conflict', async () => {
    fetchMock.mockImplementation(async () => json({ code: 'CONFLICT', message: 'changed' }, 409))
    await expect(createDataApiClient(async () => null).post('members/lock')).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
