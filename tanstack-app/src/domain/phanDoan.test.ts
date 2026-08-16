import { describe, expect, it } from 'vitest'
import { isPhanDoanValue, PHAN_DOAN_VALUES, phanDoanSelectData } from './phanDoan'

describe('PHAN_DOAN_VALUES', () => {
  it('has exactly four Vietnamese labels', () => {
    expect([...PHAN_DOAN_VALUES]).toEqual([
      'Phân đoàn 1',
      'Phân đoàn 2',
      'Phân đoàn 3',
      'Phân đoàn 4',
    ])
  })

  it('guards allowed values only', () => {
    expect(isPhanDoanValue('Phân đoàn 2')).toBe(true)
    expect(isPhanDoanValue('2')).toBe(false)
    expect(isPhanDoanValue('')).toBe(false)
  })

  it('select data uses label as value', () => {
    expect(phanDoanSelectData()).toEqual([
      { value: 'Phân đoàn 1', label: 'Phân đoàn 1' },
      { value: 'Phân đoàn 2', label: 'Phân đoàn 2' },
      { value: 'Phân đoàn 3', label: 'Phân đoàn 3' },
      { value: 'Phân đoàn 4', label: 'Phân đoàn 4' },
    ])
  })
})
