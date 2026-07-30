export type Gmt7DayBound = 'start' | 'end'

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function isoToGmt7Date(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  // Shift UTC instant into GMT+7 wall clock, then read Y-M-D from UTC getters
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`
}

export function gmt7DateToIso(date: string, bound: Gmt7DayBound): string {
  if (!DATE_RE.test(date)) return ''
  const time = bound === 'start' ? '00:00:00' : '23:59:59'
  const parsed = new Date(`${date}T${time}+07:00`)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}
