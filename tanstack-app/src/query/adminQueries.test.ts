import { describe, expect, it, vi } from 'vitest'
import { adminKeys } from './adminKeys'
import { directorySecretariesQuery } from './adminQueries'

vi.mock('#/repositories/memberRepo', () => ({
  memberRepo: { listDirectorySecretaries: vi.fn() },
}))

describe('directorySecretariesQuery', () => {
  it('uses directorySecretaries key and staleTime 60s', () => {
    const opts = directorySecretariesQuery()
    expect(opts.queryKey).toEqual(adminKeys.directorySecretaries())
    expect(opts.staleTime).toBe(60_000)
  })
})
