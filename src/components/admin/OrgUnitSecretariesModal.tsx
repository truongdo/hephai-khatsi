import {
  Button,
  Group,
  Modal,
  Table,
  Text,
} from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useAuth } from '#/auth/useAuth'
import type { Member } from '#/domain/types'
import { isoToGmt7Date } from '#/domain/gmt7Date'
import { revokeDirectoryRole } from '#/directoryRole/directoryRoleApiClient'
import { m } from '#/paraglide/messages'
import { adminKeys } from '#/query/adminKeys'

export type OrgUnitSecretariesModalProps = {
  opened: boolean
  onClose: () => void
  orgUnitName: string
  secretaries: Member[]
}

export function directorySecretaryDisplayName(member: Member): string {
  return member.phapDanh || member.theDanh || member.email || member.id
}

function formatGrantedAt(iso: string | undefined): string {
  if (!iso) return '—'
  const ymd = isoToGmt7Date(iso)
  if (!ymd) return '—'
  const [year, month, day] = ymd.split('-')
  return `${day}/${month}/${year}`
}

export function OrgUnitSecretariesModal({
  opened,
  onClose,
  orgUnitName,
  secretaries,
}: OrgUnitSecretariesModalProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [revokeTarget, setRevokeTarget] = useState<Member | null>(null)

  useEffect(() => {
    if (!opened) {
      setRevokeTarget(null)
    }
  }, [opened])

  const revokeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const idToken = await user!.getIdToken()
      return revokeDirectoryRole({ memberId, idToken })
    },
    onSuccess: () => {
      setRevokeTarget(null)
      void queryClient.invalidateQueries({
        queryKey: adminKeys.directorySecretaries(),
      })
    },
  })

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={`${m.admin_org_units_secretaries_modal_title()} — ${orgUnitName}`}
        size="xl"
      >
        {secretaries.length === 0 ? (
          <Text>{m.admin_org_units_secretaries_empty()}</Text>
        ) : (
          <Table.ScrollContainer minWidth={800}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{m.admin_org_units_secretaries_col_name()}</Table.Th>
                  <Table.Th>{m.admin_org_units_secretaries_col_email()}</Table.Th>
                  <Table.Th>
                    {m.admin_org_units_secretaries_col_granted_at()}
                  </Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {secretaries.map((member) => (
                  <Table.Tr key={member.id}>
                    <Table.Td>{directorySecretaryDisplayName(member)}</Table.Td>
                    <Table.Td>{member.email ?? '—'}</Table.Td>
                    <Table.Td>
                      {formatGrantedAt(member.directoryRoleGrantedAt)}
                    </Table.Td>
                    <Table.Td>
                      <Button
                        variant="subtle"
                        color="red"
                        size="compact-sm"
                        onClick={() => setRevokeTarget(member)}
                      >
                        {m.admin_org_units_secretaries_revoke()}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Modal>

      <Modal
        opened={revokeTarget != null}
        onClose={() => setRevokeTarget(null)}
        title={m.admin_org_units_secretaries_revoke()}
        closeOnClickOutside={!revokeMutation.isPending}
        closeOnEscape={!revokeMutation.isPending}
      >
        <Text>{m.admin_org_units_secretaries_revoke_confirm()}</Text>
        <Group justify="flex-end" mt="md" wrap="wrap" gap="sm">
          <Button
            variant="default"
            onClick={() => setRevokeTarget(null)}
            disabled={revokeMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            color="red"
            loading={revokeMutation.isPending}
            onClick={() => {
              if (revokeTarget) {
                revokeMutation.mutate(revokeTarget.id)
              }
            }}
          >
            {m.admin_org_units_secretaries_revoke()}
          </Button>
        </Group>
      </Modal>
    </>
  )
}
