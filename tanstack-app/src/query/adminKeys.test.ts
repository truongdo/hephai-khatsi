import { describe, expect, it } from 'vitest'
import { adminKeys } from './adminKeys'

describe('adminKeys', () => {
  it('nests under admin', () => {
    expect(adminKeys.orgUnits()[0]).toBe('admin')
    expect(adminKeys.member('m1')).toEqual(['admin', 'member', 'm1'])
  })
})
