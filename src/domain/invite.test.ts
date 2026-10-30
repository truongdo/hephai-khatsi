import { describe, expect, it } from 'vitest'
import { parseInvite, retreatRegistrationInviteId } from './invite'

describe('retreatRegistrationInviteId', () => {
  it('prefixes retreat id', () => {
    expect(retreatRegistrationInviteId('abc')).toBe('retreat_abc')
  })
})

describe('parseInvite', () => {
  it('defaults legacy filler docs', () => {
    expect(
      parseInvite('public', {
        token: 'public',
        createdAt: 't',
        createdBy: 'u',
      }),
    ).toEqual({
      id: 'public',
      token: 'public',
      createdAt: 't',
      createdBy: 'u',
      kind: 'filler',
      retreatId: null,
      orgUnitId: null,
      disabled: false,
    })
  })

  it('parses retreat_registration invites', () => {
    expect(
      parseInvite('retreat_r1', {
        token: 'retreat_r1',
        createdAt: 't',
        createdBy: 'u',
        kind: 'retreat_registration',
        retreatId: 'r1',
        orgUnitId: 'gd-i',
        disabled: false,
      }),
    ).toMatchObject({
      kind: 'retreat_registration',
      retreatId: 'r1',
      orgUnitId: 'gd-i',
    })
  })
})
