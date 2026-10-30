import { describe, expect, it, vi } from 'vitest'
import { adminKeys } from './adminKeys'
import { memberAuditLogsQuery, templeAuditLogsQuery } from './auditLogQueries'

vi.mock('#/repositories/auditLogRepo', () => ({
  listAuditLogs: vi.fn(),
}))

describe('auditLogQueries', () => {
  it('memberAuditLogsQuery uses member audit key and defaults', () => {
    const opts = memberAuditLogsQuery('m1')
    expect(opts.queryKey).toEqual(adminKeys.memberAuditLogs('m1'))
    expect(opts.staleTime).toBe(60_000)
    expect(opts.enabled).toBe(true)
  })

  it('memberAuditLogsQuery disabled when memberId empty', () => {
    expect(memberAuditLogsQuery('').enabled).toBe(false)
  })

  it('templeAuditLogsQuery uses temple audit key', () => {
    const opts = templeAuditLogsQuery('t1')
    expect(opts.queryKey).toEqual(adminKeys.templeAuditLogs('t1'))
    expect(opts.staleTime).toBe(60_000)
    expect(opts.enabled).toBe(true)
  })

  it('templeAuditLogsQuery disabled when templeId empty', () => {
    expect(templeAuditLogsQuery('').enabled).toBe(false)
  })
})
