import {
  Anchor,
  Button,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { useAuth } from '#/auth/useAuth'
import { AdminDenied } from '#/components/admin/AdminDenied'
import { AdminDataTable } from '#/components/admin/AdminDataTable'
import { QueryErrorAlert } from '#/components/admin/QueryErrorAlert'
import {
  directorySecretaryDisplayName,
  OrgUnitSecretariesModal,
} from '#/components/admin/OrgUnitSecretariesModal'
import type { Member, OrgUnitKind } from '#/domain/types'
import { isoToGmt7Date } from '#/domain/gmt7Date'
import {
  canGrantDirectoryRole,
  canManageDirectory,
} from '#/domain/authClaims'
import { revokeDirectoryRole } from '#/directoryRole/directoryRoleApiClient'
import { memberRepo } from '#/repositories/memberRepo'
import { templeRepo } from '#/repositories/templeRepo'
import { reindexDirectorySearch } from '#/search/reindexDirectory'
import {
  directorySecretariesQuery,
  hePhaiSecretariesQuery,
  orgUnitsQuery,
} from '#/query/adminQueries'
import { adminKeys } from '#/query/adminKeys'

function orgUnitKindLabel(kind: OrgUnitKind): string {
  switch (kind) {
    case 'giao_doan':
      return m.admin_org_unit_kind_giao_doan()
    case 'ni_gioi':
      return m.admin_org_unit_kind_ni_gioi()
  }
}

function formatGrantedAt(iso: string | undefined): string {
  if (!iso) return '—'
  const ymd = isoToGmt7Date(iso)
  if (!ymd) return '—'
  const [year, month, day] = ymd.split('-')
  return `${day}/${month}/${year}`
}

export function OrgUnitsPage() {
  const claim = useAdminClaim()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [modalOrgUnit, setModalOrgUnit] = useState<{
    id: string
    name: string
  } | null>(null)
  const [revokeHePhaiTarget, setRevokeHePhaiTarget] = useState<Member | null>(
    null,
  )
  const [reindexConfirmOpen, setReindexConfirmOpen] = useState(false)
  const [reindexSuccess, setReindexSuccess] = useState<string | null>(null)
  const [reindexError, setReindexError] = useState<string | null>(null)

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

  const hePhaiSecretaries = useQuery({
    ...hePhaiSecretariesQuery(),
    enabled: manageDirectory && canGrant,
  })

  const revokeHePhaiMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const idToken = await user!.getIdToken()
      return revokeDirectoryRole({ memberId, idToken })
    },
    onSuccess: () => {
      setRevokeHePhaiTarget(null)
      void queryClient.invalidateQueries({
        queryKey: adminKeys.directorySecretaries(),
      })
      void queryClient.invalidateQueries({
        queryKey: adminKeys.hePhaiSecretaries(),
      })
    },
  })

  const reindexMutation = useMutation({
    mutationFn: async () => {
      const idToken = await user!.getIdToken()
      return reindexDirectorySearch({
        idToken,
        listMembers: (input) => memberRepo.listAllForExport(input),
        listTemples: () => templeRepo.listAllForExport({}),
      })
    },
    onSuccess: (result) => {
      setReindexConfirmOpen(false)
      setReindexError(null)
      setReindexSuccess(
        m.admin_search_reindex_success({
          members: result.members,
          temples: result.temples,
        }),
      )
    },
    onError: () => {
      setReindexSuccess(null)
      setReindexError(m.admin_search_reindex_error())
    },
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

      {canGrant && (
        <Stack gap="sm">
          <Group>
            <Button
              variant="light"
              onClick={() => {
                setReindexSuccess(null)
                setReindexError(null)
                setReindexConfirmOpen(true)
              }}
            >
              {m.admin_search_reindex()}
            </Button>
          </Group>
          {reindexSuccess && (
            <Text c="green" size="sm">
              {reindexSuccess}
            </Text>
          )}
          {reindexError && (
            <Text c="red" size="sm">
              {reindexError}
            </Text>
          )}
          <Title order={3}>
            {m.admin_org_units_he_phai_secretaries_title()}
          </Title>
          {(hePhaiSecretaries.data ?? []).length === 0 ? (
            <Text>{m.admin_org_units_he_phai_secretaries_empty()}</Text>
          ) : (
            <Table.ScrollContainer minWidth={800}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>
                      {m.admin_org_units_he_phai_secretaries_col_name()}
                    </Table.Th>
                    <Table.Th>
                      {m.admin_org_units_he_phai_secretaries_col_email()}
                    </Table.Th>
                    <Table.Th>
                      {m.admin_org_units_he_phai_secretaries_col_granted_at()}
                    </Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {hePhaiSecretaries.data?.map((member) => (
                    <Table.Tr key={member.id}>
                      <Table.Td>
                        {directorySecretaryDisplayName(member)}
                      </Table.Td>
                      <Table.Td>{member.email ?? '—'}</Table.Td>
                      <Table.Td>
                        {formatGrantedAt(member.directoryRoleGrantedAt)}
                      </Table.Td>
                      <Table.Td>
                        <Button
                          variant="subtle"
                          color="red"
                          size="compact-sm"
                          onClick={() => setRevokeHePhaiTarget(member)}
                        >
                          {m.admin_org_units_he_phai_secretaries_revoke()}
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Stack>
      )}

      {modalOrgUnit && (
        <OrgUnitSecretariesModal
          opened
          onClose={() => setModalOrgUnit(null)}
          orgUnitName={modalOrgUnit.name}
          secretaries={secretariesByOrgUnit.get(modalOrgUnit.id) ?? []}
        />
      )}

      <Modal
        opened={revokeHePhaiTarget != null}
        onClose={() => setRevokeHePhaiTarget(null)}
        title={m.admin_org_units_he_phai_secretaries_revoke()}
        closeOnClickOutside={!revokeHePhaiMutation.isPending}
        closeOnEscape={!revokeHePhaiMutation.isPending}
      >
        <Text>{m.admin_org_units_he_phai_secretaries_revoke_confirm()}</Text>
        <Group justify="flex-end" mt="md" wrap="wrap" gap="sm">
          <Button
            variant="default"
            onClick={() => setRevokeHePhaiTarget(null)}
            disabled={revokeHePhaiMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            color="red"
            loading={revokeHePhaiMutation.isPending}
            onClick={() => {
              if (revokeHePhaiTarget) {
                revokeHePhaiMutation.mutate(revokeHePhaiTarget.id)
              }
            }}
          >
            {m.admin_org_units_he_phai_secretaries_revoke()}
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={reindexConfirmOpen}
        onClose={() => setReindexConfirmOpen(false)}
        title={m.admin_search_reindex()}
        closeOnClickOutside={!reindexMutation.isPending}
        closeOnEscape={!reindexMutation.isPending}
      >
        <Text>{m.admin_search_reindex_confirm()}</Text>
        <Group justify="flex-end" mt="md" wrap="wrap" gap="sm">
          <Button
            variant="default"
            onClick={() => setReindexConfirmOpen(false)}
            disabled={reindexMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            loading={reindexMutation.isPending}
            onClick={() => reindexMutation.mutate()}
          >
            {m.admin_search_reindex()}
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}
