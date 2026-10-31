import { describe, expect, it } from 'vitest'
import { retreatRegistrationInviteId } from './invite'

describe('retreatRegistrationInviteId', () => {
  it('prefixes retreat id', () => {
    expect(retreatRegistrationInviteId('abc')).toBe('retreat_abc')
  })
})
