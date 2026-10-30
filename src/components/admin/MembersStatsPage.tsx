import { Group, Loader, Stack, Table, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { AdminDenied } from '#/components/admin/AdminDenied'
import { rankLabel } from '#/components/filler/fillerFormOptions'
import { canManageDirectory, isHePhaiScope } from '#/domain/authClaims'
import type { SanghaType } from '#/domain/types'
import {
  memberDirectoryStatsQuery,
  orgUnitsQuery,
} from '#/query/adminQueries'

function rankStatLabel(
  rank: string | 'unknown',
  sanghaType: SanghaType,
): string {
  if (rank === 'unknown') return m.admin_member_stats_rank_unknown()
  return rankLabel(rank, sanghaType) ?? rank
}

export function MembersStatsPage() {
  const claim = useAdminClaim()

  const manageDirectory =
    claim.status === 'admin' &&
    canManageDirectory({ role: claim.role, orgUnitId: claim.orgUnitId })

  const claims =
    claim.status === 'admin'
      ? { role: claim.role, orgUnitId: claim.orgUnitId }
      : null

  const isHePhaiScoped =
    claim.status === 'admin' &&
    isHePhaiScope({ role: claim.role, orgUnitId: claim.orgUnitId })

  const scopedOrgUnitId =
    claim.status === 'admin' && claim.role === 'giao_doan_admin'
      ? claim.orgUnitId
      : null

  const orgUnits = useQuery({
    ...orgUnitsQuery(),
    enabled: manageDirectory,
  })

  const orgUnitIdsForBreakdown =
    claims && isHePhaiScope(claims)
      ? (orgUnits.data?.map((unit) => unit.id) ?? [])
      : []

  const statsScope = {
    orgUnitId: scopedOrgUnitId,
    orgUnitIdsForBreakdown,
  }

  const statsEnabled =
    manageDirectory &&
    (isHePhaiScoped
      ? !orgUnits.isPending && orgUnits.isSuccess
      : typeof scopedOrgUnitId === 'string')

  const stats = useQuery({
    ...memberDirectoryStatsQuery(statsScope),
    enabled: statsEnabled,
  })

  const orgUnitNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const unit of orgUnits.data ?? []) {
      map.set(unit.id, unit.name)
    }
    return map
  }, [orgUnits.data])

  const scopedOrgUnitName =
    scopedOrgUnitId != null
      ? orgUnitNameById.get(scopedOrgUnitId)
      : undefined

  const giaoDoanScopeInvalid =
    claim.status === 'admin' &&
    claim.role === 'giao_doan_admin' &&
    scopedOrgUnitId == null

  const loadError =
    giaoDoanScopeInvalid || orgUnits.isError || stats.isError

  const isLoading =
    (isHePhaiScoped && orgUnits.isPending) ||
    (statsEnabled && stats.isPending && !loadError)

  if (claim.status === 'loading') {
    return <Loader aria-label="loading" />
  }

  if (claim.status !== 'admin' || !manageDirectory) {
    return <AdminDenied />
  }

  return (
    <Stack>
      <Title order={2}>{m.admin_member_stats_title()}</Title>
      {scopedOrgUnitName ? (
        <Text>
          {`${m.admin_member_stats_scope_prefix()} ${scopedOrgUnitName}`}
        </Text>
      ) : (
        <Text>{m.admin_member_stats_subtitle()}</Text>
      )}

      {isLoading && <Loader aria-label="loading" />}

      {loadError && !isLoading && (
        <Text c="red" role="alert">
          {m.admin_member_stats_load_error()}
        </Text>
      )}

      {stats.data && !loadError && !isLoading && (
        <>
          <Group gap="xl">
            <Stack gap={0}>
              <Text size="sm">{m.admin_member_stats_total_all()}</Text>
              <Text fw={600} size="lg">{stats.data.totals.all}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="sm">{m.admin_member_stats_total_tang()}</Text>
              <Text fw={600} size="lg">{stats.data.totals.tang}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="sm">{m.admin_member_stats_total_ni()}</Text>
              <Text fw={600} size="lg">{stats.data.totals.ni}</Text>
            </Stack>
          </Group>

          {isHePhaiScoped && (
            <Stack gap="xs">
              <Title order={4}>{m.admin_member_stats_by_org_title()}</Title>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{m.admin_member_stats_col_org()}</Table.Th>
                    <Table.Th>{m.admin_member_stats_col_count()}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {stats.data.byOrgUnit.map((row) => (
                    <Table.Tr key={row.orgUnitId}>
                      <Table.Td>
                        {orgUnitNameById.get(row.orgUnitId) ?? row.orgUnitId}
                      </Table.Td>
                      <Table.Td>{row.count}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          )}

          <Stack gap="xs">
            <Title order={4}>{m.admin_member_stats_rank_tang_title()}</Title>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{m.admin_member_stats_col_rank()}</Table.Th>
                  <Table.Th>{m.admin_member_stats_col_count()}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {stats.data.byRankTang.map((row) => (
                  <Table.Tr key={row.rank}>
                    <Table.Td>{rankStatLabel(row.rank, 'tang')}</Table.Td>
                    <Table.Td>{row.count}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>

          <Stack gap="xs">
            <Title order={4}>{m.admin_member_stats_rank_ni_title()}</Title>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{m.admin_member_stats_col_rank()}</Table.Th>
                  <Table.Th>{m.admin_member_stats_col_count()}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {stats.data.byRankNi.map((row) => (
                  <Table.Tr key={row.rank}>
                    <Table.Td>{rankStatLabel(row.rank, 'ni')}</Table.Td>
                    <Table.Td>{row.count}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </>
      )}
    </Stack>
  )
}
