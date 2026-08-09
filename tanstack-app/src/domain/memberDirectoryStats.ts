export type MemberRankStatRow = {
  rank: string | 'unknown'
  count: number
}

export type MemberDirectoryStats = {
  totals: { all: number; tang: number; ni: number }
  byOrgUnit: { orgUnitId: string; count: number }[]
  byRankTang: MemberRankStatRow[]
  byRankNi: MemberRankStatRow[]
}

export function buildRankStatRows(
  rankValues: readonly string[],
  knownCounts: readonly number[],
  sanghaTotal: number,
): MemberRankStatRow[] {
  if (rankValues.length !== knownCounts.length) {
    throw new Error('rankValues and knownCounts length mismatch')
  }
  const sum = knownCounts.reduce((acc, n) => acc + n, 0)
  const rows: MemberRankStatRow[] = rankValues.map((rank, i) => ({
    rank,
    count: knownCounts[i]!,
  }))
  rows.push({ rank: 'unknown', count: Math.max(0, sanghaTotal - sum) })
  return rows
}
