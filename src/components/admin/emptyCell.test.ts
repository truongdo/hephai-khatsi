import { describe, expect, it } from 'vitest'
import { emptyCell } from './emptyCell'

describe('emptyCell', () => {
  it('returns hyphen for null, undefined, and blank strings', () => {
    expect(emptyCell(null)).toBe('-')
    expect(emptyCell(undefined)).toBe('-')
    expect(emptyCell('')).toBe('-')
    expect(emptyCell('   ')).toBe('-')
  })

  it('returns trimmed value when present', () => {
    expect(emptyCell('  HT A  ')).toBe('HT A')
    expect(emptyCell('001')).toBe('001')
  })
})
