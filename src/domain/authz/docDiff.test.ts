import { describe, expect, it } from 'vitest'
import { changedKeys, changedOnly, unchanged } from './docDiff'

describe('changedKeys', () => {
  it('treats an absent top-level field as null', () => {
    expect(changedKeys({ a: null }, {})).toEqual([])
    expect(changedKeys({}, { a: null })).toEqual([])
    expect(changedKeys({ a: undefined }, { a: null })).toEqual([])
  })

  it('reports added, removed and changed fields', () => {
    expect(changedKeys({ a: 1, b: 2 }, { b: 3, c: 4 }).sort()).toEqual(['a', 'b', 'c'])
  })

  it('compares nested maps by value, ignoring key order and undefined keys', () => {
    expect(changedKeys({ m: { x: 1, y: 2 } }, { m: { y: 2, x: 1 } })).toEqual([])
    expect(changedKeys({ m: { x: 1 } }, { m: { x: 1, y: undefined } })).toEqual([])
    expect(changedKeys({ m: { x: 1 } }, { m: { x: 2 } })).toEqual(['m'])
    // Inside a map, a null value is a field (as in Firestore and JSON).
    expect(changedKeys({ m: {} }, { m: { x: null } })).toEqual(['m'])
  })

  it('compares arrays in order', () => {
    expect(changedKeys({ l: [1, { a: 2 }] }, { l: [1, { a: 2 }] })).toEqual([])
    expect(changedKeys({ l: [1, 2] }, { l: [2, 1] })).toEqual(['l'])
    expect(changedKeys({ l: [1] }, { l: [1, 2] })).toEqual(['l'])
    expect(changedKeys({ l: [] }, { l: {} })).toEqual(['l'])
  })
})

describe('changedOnly / unchanged', () => {
  it('accepts changes limited to the allowed keys', () => {
    expect(changedOnly({ a: 1, b: 1 }, { a: 2, b: 1 }, ['a'])).toBe(true)
    expect(changedOnly({ a: 1, b: 1 }, { a: 2, b: 2 }, ['a'])).toBe(false)
  })

  it('checks the listed keys only', () => {
    expect(unchanged({ a: 1, b: 1 }, { a: 1, b: 2 }, ['a'])).toBe(true)
    expect(unchanged({ a: 1 }, { a: 2 }, ['a'])).toBe(false)
  })
})
