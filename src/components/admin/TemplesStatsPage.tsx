import { Group, Loader, Stack, Table, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { cities } from '#/data/vietnam-locations'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { AdminDenied } from '#/components/admin/AdminDenied'
import { canManageDirectory, isHePhaiScope } from '#/domain/authClaims'
import {
  orgUnitsQuery,
  templeDirectoryStatsQuery,
} from '#/query/adminQueries'

function cityStatLabel(cityName: string | 'unknown'): string {
  if (cityName === 'unknown') return m.admin_temple_stats_city_unknown()
  return cityName
}

export function TemplesStatsPage() {
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

  const cityNamesForBreakdown = cities.map((c) => c.name)

  const statsScope = {
    orgUnitId: scopedOrgUnitId,
    orgUnitIdsForBreakdown,
    cityNamesForBreakdown,
  }

  const statsEnabled =
    manageDirectory &&
    (isHePhaiScoped
      ? !orgUnits.isPending && orgUnits.isSuccess
      : typeof scopedOrgUnitId === 'string')

  const stats = useQuery({
    ...templeDirectoryStatsQuery(statsScope),
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

  const byOrgUnitSorted = useMemo(() => {
    const rows = stats.data?.byOrgUnit ?? []
    return [...rows].sort((a, b) => b.count - a.count)
  }, [stats.data?.byOrgUnit])

  const byCitySorted = useMemo(() => {
    const rows = stats.data?.byCity ?? []
    const known = rows
      .filter((row) => row.cityName !== 'unknown')
      .sort((a, b) => b.count - a.count)
    const unknown = rows.filter((row) => row.cityName === 'unknown')
    return [...known, ...unknown]
  }, [stats.data?.byCity])

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
      <Title order={2}>{m.admin_temple_stats_title()}</Title>
      {scopedOrgUnitName ? (
        <Text>
          {`${m.admin_temple_stats_scope_prefix()} ${scopedOrgUnitName}`}
        </Text>
      ) : (
        <Text>{m.admin_temple_stats_subtitle()}</Text>
      )}

      {isLoading && <Loader aria-label="loading" />}

      {loadError && !isLoading && (
        <Text c="red" role="alert">
          {m.admin_temple_stats_load_error()}
        </Text>
      )}

      {stats.data && !loadError && !isLoading && (
        <>
          <Group gap="xl">
            <Stack gap={0}>
              <Text size="sm">{m.admin_temple_stats_total_all()}</Text>
              <Text fw={600} size="lg">{stats.data.totals.all}</Text>
            </Stack>
          </Group>

          {isHePhaiScoped && (
            <Stack gap="xs">
              <Title order={4}>{m.admin_temple_stats_by_org_title()}</Title>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{m.admin_temple_stats_col_org()}</Table.Th>
                    <Table.Th>{m.admin_temple_stats_col_count()}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {byOrgUnitSorted.map((row) => (
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
            <Title order={4}>{m.admin_temple_stats_by_city_title()}</Title>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{m.admin_temple_stats_col_city()}</Table.Th>
                  <Table.Th>{m.admin_temple_stats_col_count()}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {byCitySorted.map((row) => (
                  <Table.Tr key={row.cityName}>
                    <Table.Td>{cityStatLabel(row.cityName)}</Table.Td>
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
