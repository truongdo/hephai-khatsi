import { Stack, Table, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { AdminDenied } from '#/components/admin/AdminDenied'
import { AdminDataTable } from '#/components/admin/AdminDataTable'
import { QueryErrorAlert } from '#/components/admin/QueryErrorAlert'
import type { OrgUnitKind } from '#/domain/types'
import { canManageDirectory } from '#/domain/authClaims'
import { orgUnitsQuery } from '#/query/adminQueries'

function orgUnitKindLabel(kind: OrgUnitKind): string {
  switch (kind) {
    case 'giao_doan':
      return m.admin_org_unit_kind_giao_doan()
    case 'ni_gioi':
      return m.admin_org_unit_kind_ni_gioi()
  }
}

export function OrgUnitsPage() {
  const claim = useAdminClaim()

  const manageDirectory =
    claim.status === 'admin' &&
    canManageDirectory({ role: claim.role, orgUnitId: claim.orgUnitId })

  const { data, isPending, isError, error } = useQuery({
    ...orgUnitsQuery(),
    enabled: manageDirectory,
  })

  if (claim.status === 'admin' && !manageDirectory) {
    return <AdminDenied />
  }

  return (
    <Stack>
      <Title order={2}>{m.admin_nav_org_units()}</Title>
      {isError && error && <QueryErrorAlert error={error} />}
      {!isError && (
        <AdminDataTable
          loading={isPending}
          empty={!isPending && (data?.length ?? 0) === 0}
          aria-label={m.admin_nav_org_units()}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{m.admin_org_units_col_code()}</Table.Th>
              <Table.Th>{m.admin_org_units_col_name()}</Table.Th>
              <Table.Th>{m.admin_org_units_col_kind()}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(data ?? []).map((unit) => (
              <Table.Tr key={unit.id}>
                <Table.Td>{unit.code}</Table.Td>
                <Table.Td>{unit.name}</Table.Td>
                <Table.Td>{orgUnitKindLabel(unit.kind)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </AdminDataTable>
      )}
    </Stack>
  )
}
