import { describe, expect, it } from 'vitest'
import { buildAuditChanges } from './buildAuditChanges'

describe('buildAuditChanges', () => {
  it('returns empty when equal', () => {
    expect(buildAuditChanges({ a: 1 }, { a: 1 })).toEqual([])
  })

  it('ignores updatedAt', () => {
    expect(
      buildAuditChanges(
        { name: 'A', updatedAt: 't1' },
        { name: 'A', updatedAt: 't2' },
      ),
    ).toEqual([])
  })

  it('records top-level change', () => {
    expect(buildAuditChanges({ name: 'A' }, { name: 'B' })).toEqual([
      { path: 'name', before: 'A', after: 'B' },
    ])
  })

  it('records nested path with dot notation', () => {
    expect(
      buildAuditChanges(
        { truTri: { dienThoai: '01' } },
        { truTri: { dienThoai: '02' } },
      ),
    ).toEqual([{ path: 'truTri.dienThoai', before: '01', after: '02' }])
  })

  it('treats null before as empty object for created-style diffs', () => {
    expect(buildAuditChanges(null, { name: 'A', updatedAt: 't' })).toEqual([
      { path: 'name', before: undefined, after: 'A' },
    ])
  })

  it('records null ↔ value', () => {
    expect(buildAuditChanges({ photoPath: null }, { photoPath: 'p.jpg' })).toEqual([
      { path: 'photoPath', before: null, after: 'p.jpg' },
    ])
  })
})
