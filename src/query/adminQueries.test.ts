import { describe, expect, it, vi } from 'vitest'
import { adminKeys } from './adminKeys'
import { directorySecretariesQuery, hePhaiSecretariesQuery } from './adminQueries'

vi.mock('#/repositories/memberRepo', () => ({
  memberRepo: {
    listDirectorySecretaries: vi.fn(),
    listHePhaiSecretaries: vi.fn(),
  },
}))

describe('directorySecretariesQuery', () => {
  it('uses directorySecretaries key and staleTime 60s', () => {
    const opts = directorySecretariesQuery()
    expect(opts.queryKey).toEqual(adminKeys.directorySecretaries())
    expect(opts.staleTime).toBe(60_000)
  })
})

describe('hePhaiSecretariesQuery', () => {
  it('uses hePhaiSecretaries key and staleTime 60s', () => {
    const opts = hePhaiSecretariesQuery()
    expect(opts.queryKey).toEqual(adminKeys.hePhaiSecretaries())
    expect(opts.staleTime).toBe(60_000)
  })
})
