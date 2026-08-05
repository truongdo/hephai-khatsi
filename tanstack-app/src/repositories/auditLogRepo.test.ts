import { describe, expect, it } from 'vitest'
import { shouldWriteAudit } from './auditLogRepo'

describe('shouldWriteAudit', () => {
  it('skips empty updated', () => {
    expect(shouldWriteAudit('updated', [])).toBe(false)
  })

  it('writes empty locked', () => {
    expect(shouldWriteAudit('locked', [])).toBe(true)
  })

  it('writes non-empty updated', () => {
    expect(shouldWriteAudit('updated', [{ path: 'a', before: 1, after: 2 }])).toBe(
      true,
    )
  })
})
