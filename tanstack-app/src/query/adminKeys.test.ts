import { describe, expect, it } from 'vitest'
import { adminKeys } from './adminKeys'

describe('adminKeys', () => {
  it('nests under admin', () => {
    expect(adminKeys.orgUnits()[0]).toBe('admin')
    expect(adminKeys.member('m1')).toEqual(['admin', 'member', 'm1'])
  })

  it('memberAuditLogs nests under member', () => {
    expect(adminKeys.memberAuditLogs('m1')).toEqual([
      'admin',
      'member',
      'm1',
      'auditLogs',
    ])
  })

  it('templeAuditLogs nests under temple', () => {
    expect(adminKeys.templeAuditLogs('t1')).toEqual([
      'admin',
      'temple',
      't1',
      'auditLogs',
    ])
  })

  it('memberDirectoryStats nests under admin with scope', () => {
    expect(
      adminKeys.memberDirectoryStats({
        orgUnitId: 'gd-i',
        orgUnitIdsForBreakdown: [],
      }),
    ).toEqual([
      'admin',
      'memberDirectoryStats',
      { orgUnitId: 'gd-i', orgUnitIdsForBreakdown: [] },
    ])
  })
})
