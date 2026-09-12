export type TempleCityStatRow = {
  cityName: string | 'unknown'
  count: number
}

export type TempleDirectoryStats = {
  totals: { all: number }
  byOrgUnit: { orgUnitId: string; count: number }[]
  byCity: TempleCityStatRow[]
}

export function buildCityStatRows(
  cityNames: readonly string[],
  knownCounts: readonly number[],
  total: number,
): TempleCityStatRow[] {
  if (cityNames.length !== knownCounts.length) {
    throw new Error('cityNames and knownCounts length mismatch')
  }
  const sum = knownCounts.reduce((acc, n) => acc + n, 0)
  const rows: TempleCityStatRow[] = cityNames.map((cityName, i) => ({
    cityName,
    count: knownCounts[i]!,
  }))
  rows.push({ cityName: 'unknown', count: Math.max(0, total - sum) })
  return rows
}
