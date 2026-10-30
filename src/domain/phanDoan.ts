export const PHAN_DOAN_VALUES = [
  'Phân đoàn 1',
  'Phân đoàn 2',
  'Phân đoàn 3',
  'Phân đoàn 4',
] as const

export type PhanDoanValue = (typeof PHAN_DOAN_VALUES)[number]

export function isPhanDoanValue(value: string): value is PhanDoanValue {
  return (PHAN_DOAN_VALUES as readonly string[]).includes(value)
}

export function phanDoanSelectData(): Array<{ value: string; label: string }> {
  return PHAN_DOAN_VALUES.map((value) => ({ value, label: value }))
}
