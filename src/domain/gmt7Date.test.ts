import { describe, expect, it } from 'vitest'
import { gmt7DateToIso, isoToGmt7Date } from './gmt7Date'

describe('gmt7DateToIso', () => {
  it('maps start bound to 00:00:00+07:00 as UTC ISO', () => {
    expect(gmt7DateToIso('2026-08-01', 'start')).toBe(
      '2026-07-31T17:00:00.000Z',
    )
  })

  it('maps end bound to 23:59:59+07:00 as UTC ISO', () => {
    expect(gmt7DateToIso('2026-08-10', 'end')).toBe(
      '2026-08-10T16:59:59.000Z',
    )
  })

  it('returns empty for blank or invalid date', () => {
    expect(gmt7DateToIso('', 'start')).toBe('')
    expect(gmt7DateToIso('not-a-date', 'end')).toBe('')
  })
})

describe('isoToGmt7Date', () => {
  it('formats stored start instant as GMT+7 calendar date', () => {
    expect(isoToGmt7Date('2026-07-31T17:00:00.000Z')).toBe('2026-08-01')
  })

  it('formats stored end instant as GMT+7 calendar date', () => {
    expect(isoToGmt7Date('2026-08-10T16:59:59.000Z')).toBe('2026-08-10')
  })

  it('returns empty for blank or invalid iso', () => {
    expect(isoToGmt7Date('')).toBe('')
    expect(isoToGmt7Date('nope')).toBe('')
  })

  it('round-trips date part for start and end', () => {
    const day = '2026-09-15'
    expect(isoToGmt7Date(gmt7DateToIso(day, 'start'))).toBe(day)
    expect(isoToGmt7Date(gmt7DateToIso(day, 'end'))).toBe(day)
  })
})
