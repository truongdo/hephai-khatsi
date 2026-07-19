import { describe, expect, it } from 'vitest'
import { fillerKeys } from './fillerKeys'

describe('fillerKeys', () => {
  it('nests under filler', () => {
    expect(fillerKeys.orgUnits()[0]).toBe('filler')
    expect(fillerKeys.invite('public')).toEqual(['filler', 'invite', 'public'])
  })
})
