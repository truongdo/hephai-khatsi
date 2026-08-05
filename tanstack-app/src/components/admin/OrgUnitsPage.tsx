import { Anchor, Stack, Table, Title, UnstyledButton } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { AdminDenied } from '#/components/admin/AdminDenied'
import { AdminDataTable } from '#/components/admin/AdminDataTable'
import { QueryErrorAlert } from '#/components/admin/QueryErrorAlert'
import {
  directorySecretaryDisplayName,
  OrgUnitSecretariesModal,
} from '#/components/admin/OrgUnitSecretariesModal'
import type { Member, OrgUnitKind } from '#/domain/types'
import {
  canGrantDirectoryRole,
  canManageDirectory,
} from '#/domain/authClaims'
import {
  directorySecretariesQuery,
  orgUnitsQuery,
} from '#/query/adminQueries'

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
  const [modalOrgUnit, setModalOrgUnit] = useState<{
    id: string
    name: string
  } | null>(null)

  const manageDirectory =
    claim.status === 'admin' &&
    canManageDirectory({ role: claim.role, orgUnitId: claim.orgUnitId })

  const canGrant =
    claim.status === 'admin' &&
    canGrantDirectoryRole({ role: claim.role, orgUnitId: claim.orgUnitId })

  const { data, isPending, isError, error } = useQuery({
    ...orgUnitsQuery(),
    enabled: manageDirectory,
  })

  const secretaries = useQuery({
    ...directorySecretariesQuery(),
    enabled: manageDirectory && canGrant,
  })

  const secretariesByOrgUnit = useMemo(() => {
    const map = new Map<string, Member[]>()
    for (const member of secretaries.data ?? []) {
      const list = map.get(member.orgUnitId) ?? []
      list.push(member)
      map.set(member.orgUnitId, list)
    }
    return map
  }, [secretaries.data])

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
              {canGrant && (
                <Table.Th>{m.admin_org_units_col_secretaries()}</Table.Th>
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(data ?? []).map((unit) => {
              const unitSecretaries = secretariesByOrgUnit.get(unit.id) ?? []
              const secretaryLabel =
                unitSecretaries.length === 0
                  ? m.admin_org_units_secretaries_empty()
                  : unitSecretaries
                      .map(directorySecretaryDisplayName)
                      .join(', ')

              return (
                <Table.Tr key={unit.id}>
                  <Table.Td>{unit.code}</Table.Td>
                  <Table.Td>{unit.name}</Table.Td>
                  <Table.Td>{orgUnitKindLabel(unit.kind)}</Table.Td>
                  {canGrant && (
                    <Table.Td>
                      {unitSecretaries.length === 0 ? (
                        secretaryLabel
                      ) : (
                        <UnstyledButton
                          onClick={() =>
                            setModalOrgUnit({ id: unit.id, name: unit.name })
                          }
                        >
                          <Anchor component="span">{secretaryLabel}</Anchor>
                        </UnstyledButton>
                      )}
                    </Table.Td>
                  )}
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </AdminDataTable>
      )}

      {modalOrgUnit && (
        <OrgUnitSecretariesModal
          opened
          onClose={() => setModalOrgUnit(null)}
          orgUnitName={modalOrgUnit.name}
          secretaries={secretariesByOrgUnit.get(modalOrgUnit.id) ?? []}
        />
      )}
    </Stack>
  )
}
