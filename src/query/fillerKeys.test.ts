import { describe, expect, it } from 'vitest'
import { fillerKeys } from './fillerKeys'

describe('fillerKeys', () => {
  it('nests under filler', () => {
    expect(fillerKeys.orgUnits()[0]).toBe('filler')
    expect(fillerKeys.invite('public')).toEqual(['filler', 'invite', 'public'])
  })

  it('builds member detail key', () => {
    expect(fillerKeys.member('m1')).toEqual(['filler', 'member', 'm1'])
  })

  it('builds temple detail key', () => {
    expect(fillerKeys.temple('t1')).toEqual(['filler', 'temple', 't1'])
  })
})
