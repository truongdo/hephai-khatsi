import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppQueryClient } from './queryClient'

describe('createAppQueryClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs query errors with the query key', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const client = createAppQueryClient()
    const boom = new Error('missing index')

    await expect(
      client.fetchQuery({
        queryKey: ['admin', 'members'],
        queryFn: async () => {
          throw boom
        },
        retry: false,
      }),
    ).rejects.toThrow('missing index')

    expect(errorSpy).toHaveBeenCalledWith(
      '[query error]',
      ['admin', 'members'],
      boom,
    )
  })
})
