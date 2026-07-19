import { describe, expect, it } from 'vitest'
import { DomainError, isDomainError } from './errors'

describe('DomainError', () => {
  it('is recognizable via isDomainError', () => {
    const err = new DomainError('INVITE_NOT_FOUND', 'Invite not found')
    expect(isDomainError(err)).toBe(true)
    expect(err.code).toBe('INVITE_NOT_FOUND')
  })
})
