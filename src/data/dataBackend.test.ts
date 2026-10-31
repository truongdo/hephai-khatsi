import { describe, expect, it } from 'vitest'
import { parseDataBackend } from './dataBackend'

describe('parseDataBackend', () => {
  it('selects D1 only when asked for exactly', () => {
    expect(parseDataBackend('d1')).toBe('d1')
  })

  it('keeps Firestore when unset or unknown', () => {
    expect(parseDataBackend(undefined)).toBe('firestore')
    expect(parseDataBackend('')).toBe('firestore')
    expect(parseDataBackend('D1')).toBe('firestore')
    expect(parseDataBackend('firestore')).toBe('firestore')
  })
})
